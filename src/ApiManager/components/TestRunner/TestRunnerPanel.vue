/**
 * @file TestRunnerPanel.vue
 * @description 测试套件运行器面板
 *
 * 功能：
 * - 管理测试套件（创建、编辑、删除）
 * - 从测试用例中选择添加到套件
 * - 顺序执行套件中的测试用例
 * - 展示运行结果汇总（通过/失败数、耗时统计）
 */
<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, VideoPlay, Check, Close } from '@element-plus/icons-vue';
import type { TestSuite, TestCase, TestSuiteResult, TestCaseResult, AssertionResult, MockGroup } from '@/types/mock';

const API_BASE = ref('http://localhost:3000');
const localIp = ref('localhost');

/** 测试套件列表 */
const suites = ref<TestSuite[]>([]);
/** 测试用例列表 */
const testCases = ref<TestCase[]>([]);
/** 分组数据（用于获取端口等信息） */
const groups = ref<MockGroup[]>([]);
/** 当前选中的套件 */
const currentSuiteId = ref<number | null>(null);
/** 运行结果 */
const suiteResult = ref<TestSuiteResult | null>(null);
/** 是否正在运行 */
const isRunning = ref(false);

const currentSuite = computed(() => suites.value.find(s => s.id === currentSuiteId.value));

const currentSuiteCases = computed(() => {
  if (!currentSuite.value) return [];
  return currentSuite.value.testCaseIds
    .map(id => testCases.value.find(tc => tc.id === id))
    .filter(Boolean) as TestCase[];
});

/** 加载数据 */
const loadData = async () => {
  try {
    const [suitesRes, casesRes, groupsRes] = await Promise.all([
      fetch(`${API_BASE.value}/_admin/testsuites`),
      fetch(`${API_BASE.value}/_admin/testcases`),
      fetch(`${API_BASE.value}/_admin/rules`),
    ]);
    suites.value = await suitesRes.json();
    testCases.value = await casesRes.json();
    groups.value = await groupsRes.json();
  } catch {
    console.error('加载测试数据失败');
  }
};

/** 新建测试套件 */
const addSuite = () => {
  ElMessageBox.prompt('请输入套件名称', '新建测试套件').then(({ value }: any) => {
    if (!value) return;
    const now = Date.now();
    const suite: TestSuite = {
      id: now,
      name: value,
      testCaseIds: [],
      createdAt: now,
      updatedAt: now,
    };
    suites.value.push(suite);
    saveSuites();
    currentSuiteId.value = suite.id;
  }).catch(() => {});
};

/** 删除测试套件 */
const deleteSuite = (id: number) => {
  ElMessageBox.confirm('确定删除该测试套件吗？', '提示', { type: 'warning' }).then(() => {
    suites.value = suites.value.filter(s => s.id !== id);
    if (currentSuiteId.value === id) {
      currentSuiteId.value = null;
      suiteResult.value = null;
    }
    saveSuites();
  }).catch(() => {});
};

/** 添加测试用例到套件 */
const showAddCaseDialog = ref(false);
const selectedCaseIds = ref<number[]>([]);

const openAddCaseDialog = () => {
  selectedCaseIds.value = [];
  showAddCaseDialog.value = true;
};

const confirmAddCases = () => {
  if (!currentSuite.value) return;
  const existing = new Set(currentSuite.value.testCaseIds);
  selectedCaseIds.value.forEach(id => {
    if (!existing.has(id)) currentSuite.value!.testCaseIds.push(id);
  });
  saveSuites();
  showAddCaseDialog.value = false;
};

/** 从套件中移除用例 */
const removeCaseFromSuite = (caseId: number) => {
  if (!currentSuite.value) return;
  currentSuite.value.testCaseIds = currentSuite.value.testCaseIds.filter(id => id !== caseId);
  saveSuites();
};

/** 保存套件 */
const saveSuites = async () => {
  try {
    await fetch(`${API_BASE.value}/_admin/testsuites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suites.value),
    });
  } catch {}
};

/** 评估单个断言 */
function evaluateAssertion(assertion: any, status: number, responseText: string, headers: Record<string, string>, duration: number): AssertionResult {
  let actual = '';
  switch (assertion.target) {
    case 'status': actual = String(status); break;
    case 'body':
      if (assertion.key) {
        try {
          let obj = JSON.parse(responseText);
          for (const k of assertion.key.split('.')) { obj = obj?.[k]; }
          actual = obj == null ? '' : String(obj);
        } catch { actual = ''; }
      } else {
        actual = responseText;
      }
      break;
    case 'header': actual = assertion.key ? (headers[assertion.key.toLowerCase()] || '') : ''; break;
    case 'responseTime': actual = String(duration); break;
  }

  let passed = false;
  switch (assertion.operator) {
    case 'equals': passed = actual === assertion.value; break;
    case 'contains': passed = actual.includes(assertion.value); break;
    case 'regex': try { passed = new RegExp(assertion.value).test(actual); } catch { passed = false; } break;
    case 'exists': passed = actual !== '' && actual !== 'undefined' && actual !== 'null'; break;
    case 'gt': passed = Number(actual) > Number(assertion.value); break;
    case 'lt': passed = Number(actual) < Number(assertion.value); break;
  }

  return {
    assertion,
    passed,
    actual,
    message: passed ? '通过' : `期望 ${assertion.operator} ${assertion.value}，实际为 ${actual}`,
  };
}

/** 运行测试套件 */
const runSuite = async () => {
  if (!currentSuite.value || !currentSuiteCases.value.length) return;
  isRunning.value = true;
  suiteResult.value = null;

  const startTime = Date.now();
  const results: TestCaseResult[] = [];

  for (const tc of currentSuiteCases.value) {
    try {
      // 找到对应的分组以获取端口信息
      const group = groups.value.find(g => g.id === tc.groupId || g.children.some(r => r.id === tc.ruleId));
      let targetUrl = '';

      if (group?.config?.running && group.config.port) {
        let prefix = group.config.prefix || '';
        if (prefix && !prefix.startsWith('/')) prefix = '/' + prefix;
        if (prefix && prefix.endsWith('/')) prefix = prefix.slice(0, -1);
        let urlPath = tc.url || '';
        if (urlPath && !urlPath.startsWith('/')) urlPath = '/' + urlPath;
        targetUrl = `http://${localIp.value}:${group.config.port}${prefix}${urlPath}`;
      } else {
        targetUrl = `${API_BASE.value}${tc.url}`;
      }

      // 构建请求
      const fetchOptions: RequestInit = { method: tc.method };
      const customHeaders: Record<string, string> = {};

      tc.headers?.forEach(h => {
        if (h.key && h.value) customHeaders[h.key] = h.value;
      });

      if (tc.method !== 'GET' && tc.body) {
        if (tc.body.type === 'json' && tc.body.raw) {
          customHeaders['Content-Type'] = 'application/json';
          fetchOptions.body = tc.body.raw;
        }
      }

      if (Object.keys(customHeaders).length) fetchOptions.headers = customHeaders;

      // 添加 query 参数
      if (tc.params?.length) {
        const url = new URL(targetUrl);
        tc.params.forEach(p => { if (p.key) url.searchParams.set(p.key, p.value || ''); });
        targetUrl = url.toString();
      }

      const reqStart = Date.now();
      const res = await fetch(targetUrl, fetchOptions);
      const duration = Date.now() - reqStart;
      const text = await res.text();

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });

      // 评估断言
      const assertionResults = tc.assertions.map(a =>
        evaluateAssertion(a, res.status, text, resHeaders, duration)
      );

      results.push({
        testCaseId: tc.id,
        testCaseName: tc.name,
        passed: assertionResults.length === 0 || assertionResults.every(r => r.passed),
        status: res.status,
        duration,
        assertionResults,
      });
    } catch (e: any) {
      results.push({
        testCaseId: tc.id,
        testCaseName: tc.name,
        passed: false,
        status: 0,
        duration: 0,
        assertionResults: [],
        error: e.message,
      });
    }
  }

  const endTime = Date.now();
  suiteResult.value = {
    suiteId: currentSuite.value.id,
    suiteName: currentSuite.value.name,
    startTime,
    endTime,
    totalDuration: endTime - startTime,
    totalCases: results.length,
    passedCases: results.filter(r => r.passed).length,
    failedCases: results.filter(r => !r.passed).length,
    results,
  };

  isRunning.value = false;
  ElMessage.success(`测试完成: ${suiteResult.value.passedCases}/${suiteResult.value.totalCases} 通过`);
};

onMounted(() => {
  if (window.services) {
    localIp.value = window.services.getLocalIP();
    API_BASE.value = window.services.getServerUrl();
  }
  loadData();
});
</script>

<template>
  <div class="test-runner">
    <!-- 左侧：套件列表 -->
    <div class="runner-sidebar">
      <div class="sidebar-header">
        <span>测试套件</span>
        <el-button type="primary" size="small" :icon="Plus" circle @click="addSuite" />
      </div>
      <el-scrollbar>
        <div class="suite-list">
          <div
            v-for="suite in suites"
            :key="suite.id"
            class="suite-item"
            :class="{ active: currentSuiteId === suite.id }"
            @click="currentSuiteId = suite.id; suiteResult = null"
          >
            <span class="suite-name">{{ suite.name }}</span>
            <span class="suite-count">{{ suite.testCaseIds.length }} 个用例</span>
            <el-button link type="danger" size="small" class="del-btn" @click.stop="deleteSuite(suite.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <div v-if="!suites.length" class="empty-tip">暂无测试套件</div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 右侧：套件详情 -->
    <div class="runner-main">
      <template v-if="currentSuite">
        <!-- 操作栏 -->
        <div class="runner-toolbar">
          <span class="suite-title">{{ currentSuite.name }}</span>
          <div class="toolbar-actions">
            <el-button type="primary" :icon="Plus" size="small" plain @click="openAddCaseDialog">添加用例</el-button>
            <el-button type="success" :icon="VideoPlay" size="small" @click="runSuite" :loading="isRunning" :disabled="!currentSuiteCases.length">
              {{ isRunning ? '运行中...' : '运行套件' }}
            </el-button>
          </div>
        </div>

        <!-- 结果汇总 -->
        <div v-if="suiteResult" class="result-summary">
          <div class="summary-item total">
            <span class="num">{{ suiteResult.totalCases }}</span>
            <span class="label">总计</span>
          </div>
          <div class="summary-item passed">
            <span class="num">{{ suiteResult.passedCases }}</span>
            <span class="label">通过</span>
          </div>
          <div class="summary-item failed">
            <span class="num">{{ suiteResult.failedCases }}</span>
            <span class="label">失败</span>
          </div>
          <div class="summary-item time">
            <span class="num">{{ suiteResult.totalDuration }}</span>
            <span class="label">ms</span>
          </div>
        </div>

        <!-- 用例列表 -->
        <el-scrollbar>
          <div class="case-list">
            <div v-for="tc in currentSuiteCases" :key="tc.id" class="case-item">
              <div class="case-header">
                <!-- 结果图标 -->
                <template v-if="suiteResult">
                  <el-icon v-if="suiteResult.results.find(r => r.testCaseId === tc.id)?.passed" color="#67C23A"><Check /></el-icon>
                  <el-icon v-else color="#F56C6C"><Close /></el-icon>
                </template>
                <el-tag size="small" :type="tc.method === 'GET' ? 'primary' : tc.method === 'POST' ? 'success' : tc.method === 'PUT' ? 'warning' : 'danger'" effect="dark">
                  {{ tc.method }}
                </el-tag>
                <span class="case-name">{{ tc.name }}</span>
                <span class="case-url">{{ tc.url }}</span>
                <span class="case-assertions">{{ tc.assertions.length }} 断言</span>
                <el-button link type="danger" size="small" @click="removeCaseFromSuite(tc.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>

              <!-- 展开断言结果 -->
              <div v-if="suiteResult" class="case-results">
                <template v-for="result in suiteResult.results.find(r => r.testCaseId === tc.id)?.assertionResults" :key="result.assertion.id">
                  <div class="assertion-line" :class="{ passed: result.passed, failed: !result.passed }">
                    <el-icon v-if="result.passed" color="#67C23A"><Check /></el-icon>
                    <el-icon v-else color="#F56C6C"><Close /></el-icon>
                    <span>{{ result.message }}</span>
                    <span class="actual-val">实际: {{ result.actual }}</span>
                  </div>
                </template>
                <div v-if="suiteResult.results.find(r => r.testCaseId === tc.id)?.error" class="case-error">
                  {{ suiteResult.results.find(r => r.testCaseId === tc.id)?.error }}
                </div>
              </div>
            </div>
            <div v-if="!currentSuiteCases.length" class="empty-tip" style="padding: 40px">
              暂无测试用例。点击"添加用例"选择已保存的测试用例。
            </div>
          </div>
        </el-scrollbar>
      </template>

      <div v-else class="empty-state">
        <el-empty description="从左侧选择或创建测试套件" />
      </div>
    </div>

    <!-- 添加用例弹窗 -->
    <el-dialog v-model="showAddCaseDialog" title="添加测试用例" width="500px" destroy-on-close>
      <div v-if="testCases.length" class="case-select-list">
        <el-checkbox-group v-model="selectedCaseIds">
          <el-checkbox v-for="tc in testCases" :key="tc.id" :value="tc.id" :label="tc.id" style="display: flex; margin-bottom: 6px">
            <el-tag size="small" :type="tc.method === 'GET' ? 'primary' : 'success'" effect="dark" style="margin-right: 6px">{{ tc.method }}</el-tag>
            {{ tc.name }} <span style="color: #86909c; font-size: 11px; margin-left: 4px">{{ tc.url }}</span>
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <div v-else class="empty-tip" style="padding: 20px; text-align: center">
        暂无测试用例。请先在接口编辑器中保存测试用例。
      </div>
      <template #footer>
        <el-button @click="showAddCaseDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmAddCases" :disabled="!selectedCaseIds.length">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.test-runner {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.runner-sidebar {
  width: 240px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  color: var(--text-primary);
}

.suite-list {
  padding: 8px;
}

.suite-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.2s;
}

.suite-item:hover { background: var(--bg-hover); }
.suite-item.active { background: var(--primary-bg); color: var(--primary-color); }

.suite-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suite-count {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.suite-item .del-btn { opacity: 0; transition: opacity 0.2s; }
.suite-item:hover .del-btn { opacity: 1; }

.runner-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.runner-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
}

.suite-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.result-summary {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-hover);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.summary-item .num { font-size: 20px; font-weight: 700; }
.summary-item .label { font-size: 11px; color: var(--text-secondary); }
.summary-item.passed .num { color: #67C23A; }
.summary-item.failed .num { color: #F56C6C; }
.summary-item.time .num { color: #E6A23C; }

.case-list {
  padding: 12px 16px;
}

.case-item {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
}

.case-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}

.case-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.case-url {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-assertions {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.case-results {
  padding: 4px 12px 8px 36px;
  background: var(--bg-hover);
}

.assertion-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  font-size: 12px;
}

.assertion-line.passed { color: #67C23A; }
.assertion-line.failed { color: #F56C6C; }
.actual-val { margin-left: auto; color: var(--text-secondary); font-family: monospace; font-size: 11px; }

.case-error {
  padding: 4px 0;
  color: #F56C6C;
  font-size: 12px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.empty-tip {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 20px;
}

.case-select-list {
  max-height: 400px;
  overflow-y: auto;
}
</style>
