"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Like useActionState, but submits via onSubmit so React doesn't reset the
 * form's fields after the action — typed input survives validation errors. */
export function usePreservingAction(action: Action) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>, confirmText?: string) => {
    e.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, onSubmit };
}

export function ActionForm({
  action,
  children,
  className,
  confirmText,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const { state, pending, onSubmit } = usePreservingAction(action);
  return (
    <form className={className} onSubmit={(e) => onSubmit(e, confirmText)}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mt-2 text-sm text-ok">
          {state.ok}
        </p>
      )}
    </form>
  );
}
