// 定义 window.services 的类型，方便前端调用 preload
export interface IPreloadServices {
    readFile: (path: string) => string;
    writeTextFile: (text: string) => string;
    writeImageFile: (base64: string) => string | undefined;
    getServerUrl: () => string;
}
// 扩展 Window 接口
declare global {
    interface Window {
        services: IPreloadServices;
    }
}