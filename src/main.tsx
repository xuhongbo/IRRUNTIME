// 文件说明：自动补充文件级注释，描述模块职责与用途

// 应用入口：挂载根组件
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("main.tsx: Mounting root...");

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

console.log("main.tsx: Root mounted.");
