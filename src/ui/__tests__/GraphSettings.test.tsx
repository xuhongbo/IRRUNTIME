import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { GraphSettings } from "../GraphSettings";

const contract = {
  inputs: [{ name: "count", type: "number" as const }],
  outputs: [{ name: "result", type: "string" as const }],
};

describe("GraphSettings", () => {
  it("applies contract updates", () => {
    const onApplyContract = jest.fn();
    const { getByText, getAllByPlaceholderText } = render(
      <GraphSettings
        contract={contract}
        inputValues={{}}
        onChangeInputs={() => null}
        onApplyContract={onApplyContract}
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
      />
    );
    const input = getByPlaceholderText("number");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.click(getByText("Apply Inputs"));
    expect(onChangeInputs).toHaveBeenCalledWith({ count: 42 });
  });
});
