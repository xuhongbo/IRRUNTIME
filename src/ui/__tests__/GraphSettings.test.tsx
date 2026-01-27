import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { GraphSettings } from "../GraphSettings";

const contract = {
  inputs: [{ name: "count", type: "number" as const }],
  outputs: [{ name: "result", type: "string" as const }],
};
const presets = [{ id: "p1", title: "Preset", inputs: {} }];

describe("GraphSettings", () => {
  it("applies contract updates", () => {
    const onApplyContract = jest.fn();
    const { getByText, getAllByPlaceholderText } = render(
      <GraphSettings
        contract={contract}
        inputValues={{}}
        onChangeInputs={() => null}
        onApplyContract={onApplyContract}
        presets={presets}
        onApplyPresets={() => null}
      />
    );
    const nameInputs = getAllByPlaceholderText("name");
    fireEvent.change(nameInputs[0], { target: { value: "total" } });
    fireEvent.click(getByText("Apply Contract"));
    expect(onApplyContract).toHaveBeenCalled();
    const next = onApplyContract.mock.calls[0][0];
    expect(next.inputs[0].name).toBe("total");
  });

  it("parses examples array", () => {
    const onApplyContract = jest.fn();
    const { getAllByPlaceholderText, getByText } = render(
      <GraphSettings
        contract={contract}
        inputValues={{}}
        onChangeInputs={() => null}
        onApplyContract={onApplyContract}
        presets={presets}
        onApplyPresets={() => null}
      />
    );
    const examples = getAllByPlaceholderText("examples (json array)")[0];
    fireEvent.change(examples, { target: { value: "[1,2]" } });
    fireEvent.click(getByText("Apply Contract"));
    const next = onApplyContract.mock.calls[0][0];
    expect(next.inputs[0].examples).toEqual([1, 2]);
  });

  it("applies input values", () => {
    const onChangeInputs = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <GraphSettings
        contract={contract}
        inputValues={{ count: 0 }}
        onChangeInputs={onChangeInputs}
        onApplyContract={() => null}
        presets={presets}
        onApplyPresets={() => null}
      />
    );
    const input = getByPlaceholderText("number");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.click(getByText("Apply Inputs"));
    expect(onChangeInputs).toHaveBeenCalledWith({ count: 42 });
  });

  it("applies presets", () => {
    const onApplyPresets = jest.fn();
    const { getByText } = render(
      <GraphSettings
        contract={contract}
        inputValues={{}}
        onChangeInputs={() => null}
        onApplyContract={() => null}
        presets={presets}
        onApplyPresets={onApplyPresets}
      />
    );
    fireEvent.click(getByText("Apply Presets"));
    expect(onApplyPresets).toHaveBeenCalled();
  });

  it("shows contract JSON validation errors", () => {
    const onApplyContract = jest.fn();
    const { getByTestId } = render(
      <GraphSettings
        contract={{ inputs: [{ name: "payload", type: "json" }], outputs: [] }}
        inputValues={{}}
        onChangeInputs={() => null}
        onApplyContract={onApplyContract}
        presets={[]}
        onApplyPresets={() => null}
      />
    );
    fireEvent.change(getByTestId("contract-input-default-0"), { target: { value: "{ bad json" } });
    fireEvent.change(getByTestId("contract-input-examples-0"), { target: { value: "{}" } });
    fireEvent.click(getByTestId("contract-apply"));
    expect(onApplyContract).not.toHaveBeenCalled();
    expect(getByTestId("contract-input-error-default-0")).toHaveTextContent("Default JSON invalid");
    expect(getByTestId("contract-input-error-examples-0")).toHaveTextContent("Examples must be JSON array");
  });

  it("shows graph input parse errors", () => {
    const onChangeInputs = jest.fn();
    const { getByTestId } = render(
      <GraphSettings
        contract={{ inputs: [{ name: "payload", type: "json" }], outputs: [] }}
        inputValues={{}}
        onChangeInputs={onChangeInputs}
        onApplyContract={() => null}
        presets={[]}
        onApplyPresets={() => null}
      />
    );
    fireEvent.change(getByTestId("graph-input-payload"), { target: { value: "{ bad json" } });
    fireEvent.click(getByTestId("graph-inputs-apply"));
    expect(onChangeInputs).not.toHaveBeenCalled();
    expect(getByTestId("graph-input-error-payload")).toHaveTextContent("JSON parse error");
  });

  it("shows preset JSON errors", () => {
    const onApplyPresets = jest.fn();
    const { getByTestId } = render(
      <GraphSettings
        contract={contract}
        inputValues={{}}
        onChangeInputs={() => null}
        onApplyContract={() => null}
        presets={presets}
        onApplyPresets={onApplyPresets}
      />
    );
    fireEvent.change(getByTestId("preset-inputs-0"), { target: { value: "[]" } });
    fireEvent.click(getByTestId("preset-apply"));
    expect(onApplyPresets).not.toHaveBeenCalled();
    expect(getByTestId("preset-error-0")).toHaveTextContent("Preset inputs must be JSON object");
  });
});
