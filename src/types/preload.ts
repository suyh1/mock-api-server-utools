// 定义 window.services 的类型，方便前端调用 preload
export interface IPreloadServices {
    readFile: (path: string) => string;
    writeTextFile: (text: string) => string;
    writeImageFile: (base64: string) => string | undefined;
    getServerUrl: () => string;
    getLocalIP: () => string; // 新增
}
// 扩展 Window 接口
declare global {
    interface Window {
        services: IPreloadServices;
        utools: any; // 简单声明一下 utools
    }
}