"use client";

export function ConfirmButton({
  message,
  className,
  children,
  title,
  formAction,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
  formAction?: React.ComponentProps<"button">["formAction"];
}) {
  return (
    <button
      formAction={formAction}
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
