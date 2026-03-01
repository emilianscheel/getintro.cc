import { Toast, ToastDescription, ToastViewport } from "./toast";
import { useToast } from "../../lib/use-toast";

export const Toaster = () => {
  const { toasts } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <ToastViewport>
      {toasts.map((item) => (
        <Toast key={item.id} open={item.open}>
          {item.description ? <ToastDescription>{item.description}</ToastDescription> : null}
        </Toast>
      ))}
    </ToastViewport>
  );
};
