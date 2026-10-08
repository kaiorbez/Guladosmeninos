"use client";

export function ConfirmButton({
  message,
  className,
  children,
  title,
  formAction,
  value,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
  formAction?: React.ComponentProps<"button">["formAction"];
  value?: string;
}) {
  return (
    <button
      formAction={formAction}
      value={value}
      className={className}
      title={title}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
