import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastViewport
} from "./toast";
import { useToast } from "../../lib/use-toast";

export const Toaster = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <ToastViewport>
      {toasts.map((item) => (
        <Toast key={item.id} open={item.open}>
          {item.title ? <ToastTitle>{item.title}</ToastTitle> : null}
          {item.description ? (
            <ToastDescription className={item.title ? "mt-1" : ""}>
              {item.description}
            </ToastDescription>
          ) : null}
          <ToastClose onClick={() => dismiss(item.id)} />
        </Toast>
      ))}
    </ToastViewport>
  );
};
