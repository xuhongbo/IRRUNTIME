export type TextViewModel = {
  kind: "text";
  title: string;
  body: string;
};

export type ChoiceOption = {
  key: string;
  label: string;
};

export type ChoiceViewModel = {
  kind: "choice";
  title: string;
  body: string;
  choices: ChoiceOption[];
};

export type WaitingViewModel = {
  kind: "waiting";
  title: string;
  body: string;
};

export type ErrorViewModel = {
  kind: "error";
  title: string;
  body: string;
};

export type DoneViewModel = {
  kind: "done";
  title: string;
  body: string;
};

export type ViewModel =
  | TextViewModel
  | ChoiceViewModel
  | WaitingViewModel
  | ErrorViewModel
  | DoneViewModel;
