import React, { ChangeEvent, useState } from "react";
import { Input, InputProps } from "../ui/input";
import { AdditionalFormikProps } from "@/interfaces/common";
import { Label } from "../ui/label";
import { twMerge } from "tailwind-merge";
import { get, isString } from "lodash";
import CommonIcons from "@/components/commonIcons";

export interface InputFieldProps extends InputProps {
  label?: string | React.ReactNode;
  required?: boolean;
  classNameLabel?: string;
  classNameContainer?: string;
  helperText?: string | React.ReactNode;
  afterOnChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  errorTestId?: string;
  errorId?: string;
  hintId?: string;
  passwordToggleStyle?: "icon" | "text";
  showTerminalIcons?: boolean;
}

interface PasswordToggleProps {
  styleType: "icon" | "text";
  visible: boolean;
  onToggle: () => void;
}

const PasswordToggle = ({ styleType, visible, onToggle }: PasswordToggleProps) => {
  if (styleType === "text") {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 text-sm text-ink underline cursor-pointer hover:text-charcoal"
      >
        {visible ? "Ẩn" : "Hiện"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {visible ? <CommonIcons.EyeIcon size={18} /> : <CommonIcons.EyeOffIcon size={18} />}
    </button>
  );
};

export const InputField = (props: InputFieldProps & AdditionalFormikProps) => {
  const {
    label,
    classNameLabel,
    classNameContainer,
    form,
    field,
    className,
    required,
    type,
    helperText,
    errorTestId,
    errorId,
    hintId,
    passwordToggleStyle = "icon",
    showTerminalIcons = false,
    ...restPropsInput
  } = props;
  const { name, onBlur, onChange, value } = field;
  const { errors, touched, submitCount } = form;
  const [seeText, setSeeText] = useState(false);

  const isTouched = Boolean(get(touched, name)) || submitCount > 0;
  const rawError = get(errors, name);
  const msgError = isTouched && isString(rawError) ? rawError : undefined;

  const isPasswordType = type === "password";
  const currentHintId = hintId || `${name}-hint`;
  const currentErrorId = errorId || `${name}-error`;
  const describedBy = msgError ? currentErrorId : helperText ? currentHintId : undefined;

  const onHandleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    props?.afterOnChange && props?.afterOnChange(e);
  };

  return (
    <div className={twMerge("grid w-full items-center gap-1.5", classNameContainer)}>
      {label && (
        <div className="label">
          <Label htmlFor={name} className={twMerge("mb-1", required && "required", classNameLabel)}>
            {label}
          </Label>
        </div>
      )}
      <div className="relative flex items-center">
        <Input
          type={seeText ? "text" : type}
          name={name}
          onBlur={onBlur}
          onChange={onHandleChange}
          value={value}
          id={name}
          aria-invalid={Boolean(msgError)}
          aria-describedby={describedBy}
          className={twMerge(
            className,
            msgError && "border-red-500",
            isPasswordType && passwordToggleStyle === "text" && "pr-16"
          )}
          {...restPropsInput}
        />

        {isPasswordType && (
          <PasswordToggle
            styleType={passwordToggleStyle}
            visible={seeText}
            onToggle={() => setSeeText((prev) => !prev)}
          />
        )}
      </div>

      {msgError ? (
        <p
          id={currentErrorId}
          data-testid={errorTestId || `error-${name}`}
          className="text-sm text-terminal-danger mt-1.5 flex items-center gap-1"
        >
          {showTerminalIcons && <span className="font-bold">[!]</span>}
          <span>{msgError}</span>
        </p>
      ) : helperText ? (
        <p id={currentHintId} className="text-sm text-mute mt-1.5 flex items-center gap-1">
          {showTerminalIcons && <span className="font-medium text-mute">[i]</span>}
          <span>{helperText}</span>
        </p>
      ) : null}
    </div>
  );
};

export default InputField;
