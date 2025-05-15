import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type: "single" | "multiple";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children?: React.ReactNode;
}

const ToggleGroupContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, type, value, defaultValue, onValueChange, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string | undefined>(
      value || defaultValue
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const handleValueChange = React.useCallback(
      (newValue: string) => {
        if (type === "single") {
          setInternalValue(newValue);
          onValueChange?.(newValue);
        }
      },
      [type, onValueChange]
    );

    return (
      <ToggleGroupContext.Provider
        value={{
          value: value !== undefined ? value : internalValue,
          onValueChange: handleValueChange,
        }}
      >
        <div
          ref={ref}
          className={cn("flex items-center justify-center gap-1", className)}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    );
  }
);

ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: groupValue, onValueChange } = React.useContext(ToggleGroupContext);
    const isActive = groupValue === value;

    return (
      <Button
        ref={ref}
        type="button"
        variant={isActive ? "default" : "outline"}
        size="sm"
        className={cn(className)}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
