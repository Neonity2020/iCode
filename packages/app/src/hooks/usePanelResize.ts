import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PANEL_WIDTHS } from "../config/app";

type UsePanelResizeOptions = {
  initialLeftWidth: number;
  initialRightWidth: number;
  leftOpen: boolean;
  rightOpen: boolean;
  onWidthsChange: (leftWidth: number, rightWidth: number) => void;
};

export function usePanelResize({
  initialLeftWidth,
  initialRightWidth,
  leftOpen,
  rightOpen,
  onWidthsChange,
}: UsePanelResizeOptions) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    side: "left" | "right";
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const resizeClientXRef = useRef(0);
  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);

  useEffect(() => {
    leftWidthRef.current = leftWidth;
    onWidthsChange(leftWidth, rightWidthRef.current);
  }, [leftWidth, onWidthsChange]);

  useEffect(() => {
    rightWidthRef.current = rightWidth;
    onWidthsChange(leftWidthRef.current, rightWidth);
  }, [onWidthsChange, rightWidth]);

  const applyWidthVariables = useCallback((nextLeft: number, nextRight: number) => {
    shellRef.current?.style.setProperty("--left-sidebar-width", `${nextLeft}px`);
    shellRef.current?.style.setProperty("--right-sidebar-width", `${nextRight}px`);
  }, []);

  const cancelResizeFrame = useCallback(() => {
    if (resizeRafRef.current === null) return;
    window.cancelAnimationFrame(resizeRafRef.current);
    resizeRafRef.current = null;
  }, []);

  const startResize = useCallback(
    (side: "left" | "right", event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        side,
        startX: event.clientX,
        startWidth: side === "left" ? leftWidthRef.current : rightWidthRef.current,
        currentWidth: side === "left" ? leftWidthRef.current : rightWidthRef.current,
      };
      resizeClientXRef.current = event.clientX;
      document.body.classList.add("resizing-panels");

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragRef.current) return;
        resizeClientXRef.current = moveEvent.clientX;
        if (resizeRafRef.current !== null) return;
        resizeRafRef.current = window.requestAnimationFrame(() => {
          resizeRafRef.current = null;
          const current = dragRef.current;
          if (!current) return;
          const delta = resizeClientXRef.current - current.startX;

          if (current.side === "left") {
            const available = window.innerWidth - rightWidthRef.current - 360;
            const maxWidth = Math.min(
              PANEL_WIDTHS.left.max,
              Math.max(PANEL_WIDTHS.left.min, available),
            );
            const next = Math.min(
              maxWidth,
              Math.max(PANEL_WIDTHS.left.min, current.startWidth + delta),
            );
            current.currentWidth = next;
            applyWidthVariables(leftOpen ? next : 0, rightOpen ? rightWidthRef.current : 0);
            return;
          }

          const available = window.innerWidth - leftWidthRef.current - 360;
          const maxWidth = Math.min(
            PANEL_WIDTHS.right.max,
            Math.max(PANEL_WIDTHS.right.min, available),
          );
          const next = Math.min(
            maxWidth,
            Math.max(PANEL_WIDTHS.right.min, current.startWidth - delta),
          );
          current.currentWidth = next;
          applyWidthVariables(leftOpen ? leftWidthRef.current : 0, rightOpen ? next : 0);
        });
      };

      const handleUp = () => {
        cancelResizeFrame();
        const current = dragRef.current;
        if (current?.side === "left") setLeftWidth(current.currentWidth);
        if (current?.side === "right") setRightWidth(current.currentWidth);
        dragRef.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleUp);
        document.body.classList.remove("resizing-panels");
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    },
    [applyWidthVariables, cancelResizeFrame, leftOpen, rightOpen],
  );

  return { shellRef, leftWidth, rightWidth, startResize };
}
