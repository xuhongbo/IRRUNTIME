import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("main.tsx: Mounting root...");

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

console.log("main.tsx: Root mounted.");
