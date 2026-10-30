import React from "react";
import { AdditionalFormikProps } from "@/interfaces/common";
import { Label } from "../ui/label";
import { twMerge } from "tailwind-merge";
import { get, isString } from "lodash";
import { Checkbox } from "../ui/checkbox";
import { CheckboxProps } from "@radix-ui/react-checkbox";

export interface CheckBoxFieldProps extends Omit<CheckboxProps, "form"> {
  label?: string | React.ReactNode;
  required?: boolean;
  classNameLabel?: string;
  classNameContainer?: string;
  afterOnChange?: (checked: boolean) => void;
  terminalStyle?: boolean;
  errorId?: string;
}

const TerminalCheckbox = ({
  name,
  value,
  disabled,
  msgError,
  currentErrorId,
  label,
  classNameLabel,
  onChange,
}: {
  name: string;
  value: boolean;
  disabled?: boolean;
  msgError?: string;
  currentErrorId: string;
  label?: string | React.ReactNode;
  classNameLabel?: string;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <>
      <label
        htmlFor={name}
        className={twMerge(
          "flex items-start gap-2.5 cursor-pointer select-none text-base text-body",
          classNameLabel
        )}
      >
        <input
          id={name}
          name={name}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          aria-invalid={Boolean(msgError)}
          aria-describedby={msgError ? currentErrorId : undefined}
        />
        <span
          className="font-bold text-ink select-none shrink-0 whitespace-nowrap font-mono inline-block"
          aria-hidden="true"
        >
          {value ? "[x]" : "[\u00A0]"}
        </span>
        <span className="leading-normal flex-1">{label}</span>
      </label>
      {msgError && (
        <p
          id={currentErrorId}
          className="text-sm text-terminal-danger mt-1.5 flex items-center gap-1"
        >
          <span className="font-bold shrink-0 font-mono">[!]</span>
          <span>{msgError}</span>
        </p>
      )}
    </>
  );
};

export const CheckBoxField = (props: CheckBoxFieldProps & AdditionalFormikProps) => {
  const {
    label,
    classNameLabel,
    classNameContainer,
    form,
    field,
    required,
    terminalStyle = false,
    errorId,
    disabled,
    ...restProps
  } = props;
  const { name, value } = field;
  const { errors, touched, submitCount, setFieldValue, setFieldTouched } = form;

  const isTouched = Boolean(get(touched, name)) || submitCount > 0;
  const rawError = get(errors, name);
  const msgError = isTouched && isString(rawError) ? rawError : undefined;
  const currentErrorId = errorId || `${name}-error`;

  const onHandleChange = (checked: boolean) => {
    setFieldValue(name, checked);
    props?.afterOnChange && props?.afterOnChange(checked);
    setFieldTouched(name, true);
  };

  if (terminalStyle) {
    return (
      <div className={twMerge("mb-6", classNameContainer)}>
        <TerminalCheckbox
          name={name}
          value={Boolean(value)}
          disabled={disabled}
          msgError={msgError}
          currentErrorId={currentErrorId}
          label={label}
          classNameLabel={classNameLabel}
          onChange={onHandleChange}
        />
      </div>
    );
  }

  return (
    <div className={twMerge("flex items-center gap-3", classNameContainer)}>
      <Checkbox
        id={name}
        checked={value}
        onCheckedChange={onHandleChange}
        disabled={disabled}
        {...restProps}
      />
      {label && (
        <Label
          htmlFor={name}
          className={twMerge(required && "required", classNameLabel)}
        >
          {label}
        </Label>
      )}
      {isString(msgError) && <span className="invalid-text">{msgError}</span>}
    </div>
  );
};

export default CheckBoxField;
