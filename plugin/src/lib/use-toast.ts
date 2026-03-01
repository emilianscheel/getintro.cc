import * as React from "react";

const TOAST_LIMIT = 1;
const TOAST_DURATION_MS = 3500;
const TOAST_REMOVE_DELAY = 300;

export type ToastPayload = {
  title?: React.ReactNode;
  description?: React.ReactNode;
};

export type ToasterToast = ToastPayload & {
  id: string;
  open: boolean;
};

type ToastState = {
  toasts: ToasterToast[];
};

type ToastAction =
  | {
      type: "ADD_TOAST";
      toast: ToasterToast;
    }
  | {
      type: "DISMISS_TOAST";
      toastId?: string;
    }
  | {
      type: "REMOVE_TOAST";
      toastId?: string;
    };

const listeners: Array<(state: ToastState) => void> = [];
let memoryState: ToastState = { toasts: [] };
let toastCount = 0;
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const genToastId = (): string => {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER;
  return toastCount.toString();
};

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

const reducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT)
      };
    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => addToRemoveQueue(toast.id));
      }

      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toastId === undefined || toast.id === toastId
            ? {
                ...toast,
                open: false
              }
            : toast
        )
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: []
        };
      }

      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.toastId)
      };
  }
};

const dispatch = (action: ToastAction): void => {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
};

export const toast = ({ title, description }: ToastPayload) => {
  const id = genToastId();

  dispatch({
    type: "ADD_TOAST",
    toast: {
      id,
      title,
      description,
      open: true
    }
  });

  setTimeout(() => {
    dispatch({ type: "DISMISS_TOAST", toastId: id });
  }, TOAST_DURATION_MS);

  return {
    id,
    dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id })
  };
};

export const useToast = () => {
  const [state, setState] = React.useState<ToastState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);

    return () => {
      const index = listeners.indexOf(setState);

      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId })
  };
};
