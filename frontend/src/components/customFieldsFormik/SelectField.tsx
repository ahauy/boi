import { twMerge } from "tailwind-merge";
import { AdditionalFormikProps, SelectOption } from "@/interfaces/common";
import { Label } from "../ui/label";
import { get, isString } from "lodash";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../ui/command";
import CommonIcons from "@/components/commonIcons";
import { cn } from "@/lib/utils";
import { isDefine } from "@/helpers/common";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface SelectFieldProps {
  label?: string | React.ReactNode;
  required?: boolean;
  classNameLabel?: string;
  classNameContainer?: string;
  placeholder?: string;
  placeholderSearch?: string;
  messageItemNotFound?: string;
  options: SelectOption[];
  isClearable?: boolean;
  isMulti?: boolean;
  afterOnChange?: (e: SelectOption | SelectOption[] | null) => void;
}

const SelectField = (props: SelectFieldProps & AdditionalFormikProps) => {
  //! State
  const {
    options,
    classNameContainer,
    field,
    form,
    label,
    classNameLabel,
    placeholder,
    placeholderSearch,
    messageItemNotFound,
    required,
    afterOnChange,
    isClearable = false,
    isMulti = false,
  } = props;
  const [open, setOpen] = useState(false);
  const { value, name } = field;
  const { setFieldValue, setFieldTouched, errors, touched } = form;
  const buttonRef = useRef<HTMLButtonElement>(null);

  const msgError = get(touched, name) && (get(errors, name) as string);

  // Check if value is an array (multi-select)
  const isValueArray = Array.isArray(value);

  // Get selected options for multi-select
  const getSelectedOptions = (): SelectOption[] => {
    if (!isMulti || !isValueArray) return [];
    return value
      .map((item: any) => {
        if (
          item &&
          typeof item === "object" &&
          "label" in item &&
          "value" in item
        ) {
          return item as SelectOption;
        }
        // Find option by value
        const option = options.find((opt) => `${opt.value}` === `${item}`);
        return option || null;
      })
      .filter(
        (item: SelectOption | null): item is SelectOption => item !== null
      );
  };

  const selectedOptions = getSelectedOptions();

  //! Function
  const handleSelect = (option: SelectOption) => {
    if (isMulti) {
      // Multi-select mode - always store SelectOption objects
      const currentValues = isValueArray ? [...value] : [];

      // Convert current values to SelectOption objects if they're primitives
      const currentOptions: SelectOption[] = currentValues.map((item: any) => {
        if (
          item &&
          typeof item === "object" &&
          "label" in item &&
          "value" in item
        ) {
          return item as SelectOption;
        }
        // Find the option object for primitive values
        const foundOption = options.find((opt) => `${opt.value}` === `${item}`);
        return foundOption || { label: String(item), value: item };
      });

      // Check if already selected
      const isSelected = currentOptions.some(
        (opt) => `${opt.value}` === `${option.value}`
      );

      let newValue: SelectOption[];
      if (isSelected) {
        // Remove from selection
        newValue = currentOptions.filter(
          (opt) => `${opt.value}` !== `${option.value}`
        );
      } else {
        // Add to selection
        newValue = [...currentOptions, option];
      }

      setFieldValue(name, newValue);
      afterOnChange && afterOnChange(newValue);
      // Don't close popover in multi-select mode
    } else {
      // Single select mode - always store SelectOption object
      const isSameValue =
        value &&
        typeof value === "object" &&
        "label" in value &&
        "value" in value
          ? `${(value as SelectOption).value}` === `${option.value}`
          : `${value}` === `${option.value}`;

      const result = isSameValue ? null : option;
      setFieldValue(name, result);
      afterOnChange && afterOnChange(isSameValue ? null : option);
      setOpen(false);
    }
  };

  const handleRemoveItem = (
    optionValue: string | number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!isMulti || !isValueArray) return;

    // Convert current values to SelectOption objects if they're primitives
    const currentOptions: SelectOption[] = value.map((item: any) => {
      if (
        item &&
        typeof item === "object" &&
        "label" in item &&
        "value" in item
      ) {
        return item as SelectOption;
      }
      // Find the option object for primitive values
      const foundOption = options.find((opt) => `${opt.value}` === `${item}`);
      return foundOption || { label: String(item), value: item };
    });

    // Remove the selected option
    const newValue = currentOptions.filter(
      (opt) => `${opt.value}` !== `${optionValue}`
    );

    setFieldValue(name, newValue);
    afterOnChange && afterOnChange(newValue);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      setFieldValue(name, []);
      afterOnChange && afterOnChange([]);
    } else {
      setFieldValue(name, null);
      afterOnChange && afterOnChange(null);
    }
  };

  //! Render
  const widthPopover = buttonRef.current?.getBoundingClientRect().width || 0;

  return (
    <div
      className={twMerge(
        "grid w-full items-center gap-1.5",
        classNameContainer
      )}
    >
      {label && (
        <Label
          className={twMerge("mb-1", required && "required", classNameLabel)}
        >
          {label}
        </Label>
      )}
      <Popover
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) {
            setFieldTouched(name, true);
          }
        }}
      >
        <PopoverTrigger>
          <Button
            ref={buttonRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={twMerge(
              "h-auto min-h-10 w-full justify-between text-sm font-normal",
              msgError && "border-red-500"
            )}
          >
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {isMulti && isValueArray && selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="mr-1"
                  >
                    {option.label}
                    <CommonIcons.X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={(e) => handleRemoveItem(option.value, e)}
                    />
                  </Badge>
                ))
              ) : isMulti ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : isDefine(value) ? (
                value && typeof value === "object" && "label" in value ? (
                  (value as SelectOption).label
                ) : (
                  options.find((option) => `${option.value}` === `${value}`)
                    ?.label || placeholder
                )
              ) : (
                placeholder
              )}
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {isClearable &&
                isDefine(value) &&
                (isMulti ? isValueArray && value.length > 0 : true) && (
                  <CommonIcons.X
                    className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                    onClick={handleClear}
                  />
                )}
              <CommonIcons.ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          style={{
            width: widthPopover,
          }}
        >
          <Command>
            <CommandInput placeholder={placeholderSearch || "Search item"} />
            <CommandEmpty>
              {messageItemNotFound || "No item found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = isMulti
                  ? selectedOptions.some(
                      (opt) => `${opt.value}` === `${option.value}`
                    )
                  : value &&
                    typeof value === "object" &&
                    "label" in value &&
                    "value" in value
                  ? `${(value as SelectOption).value}` === `${option.value}`
                  : `${value}` === `${option.value}`;

                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.value}`}
                    onSelect={() => handleSelect(option)}
                  >
                    <CommonIcons.Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {isString(msgError) && <span className="invalid-text">{msgError}</span>}
    </div>
  );
};

export default SelectField;
