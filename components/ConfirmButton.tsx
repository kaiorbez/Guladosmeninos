"use client";

export function ConfirmButton({
  message,
  className,
  children,
  title,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
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
