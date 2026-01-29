// 文件说明：自动补充文件级注释，描述模块职责与用途

// 文本视图模型：用于运行面板展示文本
export type TextViewModel = {
  kind: "text";
  title: string;
  body: string;
};

// 选择项
export type ChoiceOption = {
  key: string;
  label: string;
};

// 选择视图模型：展示选择列表
export type ChoiceViewModel = {
  kind: "choice";
  title: string;
  body: string;
  choices: ChoiceOption[];
};

// 等待视图模型：用于延迟或异步
export type WaitingViewModel = {
  kind: "waiting";
  title: string;
  body: string;
};

// 错误视图模型
export type ErrorViewModel = {
  kind: "error";
  title: string;
  body: string;
};

// 完成视图模型
export type DoneViewModel = {
  kind: "done";
  title: string;
  body: string;
};

// 统一视图模型类型
export type ViewModel =
  | TextViewModel
  | ChoiceViewModel
  | WaitingViewModel
  | ErrorViewModel
  | DoneViewModel;
