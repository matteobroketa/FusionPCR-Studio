import { useEffect, useRef, type RefObject } from 'react';
import { getActiveFocusableElement, isEditableElement } from '../utils/app-ui';

type ConfirmationState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

export function useAppFocusManagement({
  showInspector,
  workerError,
  confirmationState,
  issueCount,
  showWorkbench,
  calculationState,
  isDesignCurrent,
  issueDrawerHeadingRef,
  workspaceHeadingRef,
  inspectorHeadingRef,
  retryCalculationButtonRef,
  confirmationCancelButtonRef,
}: {
  showInspector: boolean;
  workerError: string | null;
  confirmationState: ConfirmationState;
  issueCount: number;
  showWorkbench: boolean;
  calculationState: 'idle' | 'pending' | 'complete' | 'stale' | 'error';
  isDesignCurrent: boolean;
  issueDrawerHeadingRef: RefObject<HTMLHeadingElement | null>;
  workspaceHeadingRef: RefObject<HTMLHeadingElement | null>;
  inspectorHeadingRef: RefObject<HTMLHeadingElement | null>;
  retryCalculationButtonRef: RefObject<HTMLButtonElement | null>;
  confirmationCancelButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);
  const confirmationTriggerRef = useRef<HTMLElement | null>(null);
  const previousShowInspectorRef = useRef(showInspector);
  const previousIssueCountRef = useRef(0);
  const previousCalculationRef = useRef<{
    state: 'idle' | 'pending' | 'complete' | 'stale' | 'error';
    isCurrent: boolean;
  }>({
    state: 'idle',
    isCurrent: false,
  });

  useEffect(() => {
    if (showInspector && !previousShowInspectorRef.current) {
      window.setTimeout(() => {
        if (workerError) {
          retryCalculationButtonRef.current?.focus();
          return;
        }
        inspectorHeadingRef.current?.focus();
      }, 180);
    }

    if (!showInspector && previousShowInspectorRef.current) {
      inspectorTriggerRef.current?.focus();
      inspectorTriggerRef.current = null;
    }

    previousShowInspectorRef.current = showInspector;
  }, [
    inspectorHeadingRef,
    retryCalculationButtonRef,
    showInspector,
    workerError,
  ]);

  useEffect(() => {
    if (confirmationState && !confirmationTriggerRef.current) {
      confirmationTriggerRef.current = getActiveFocusableElement();
      window.requestAnimationFrame(() =>
        confirmationCancelButtonRef.current?.focus(),
      );
      return;
    }

    if (!confirmationState && confirmationTriggerRef.current) {
      confirmationTriggerRef.current.focus();
      confirmationTriggerRef.current = null;
    }
  }, [confirmationCancelButtonRef, confirmationState]);

  useEffect(() => {
    const activeElement = getActiveFocusableElement();
    const becameBlocking =
      previousIssueCountRef.current === 0 && issueCount > 0;
    if (becameBlocking && showWorkbench && !isEditableElement(activeElement)) {
      window.requestAnimationFrame(() =>
        issueDrawerHeadingRef.current?.focus(),
      );
    }
    previousIssueCountRef.current = issueCount;
  }, [issueCount, issueDrawerHeadingRef, showWorkbench]);

  useEffect(() => {
    const previous = previousCalculationRef.current;
    const completedCalculation =
      (previous.state !== 'complete' || !previous.isCurrent) &&
      calculationState === 'complete' &&
      isDesignCurrent &&
      showWorkbench &&
      issueCount === 0;
    const activeElement = getActiveFocusableElement();

    if (completedCalculation && !isEditableElement(activeElement)) {
      window.requestAnimationFrame(() => workspaceHeadingRef.current?.focus());
    }

    previousCalculationRef.current = {
      state: calculationState,
      isCurrent: isDesignCurrent,
    };
  }, [
    calculationState,
    isDesignCurrent,
    issueCount,
    showWorkbench,
    workspaceHeadingRef,
  ]);

  return {
    inspectorTriggerRef,
    confirmationTriggerRef,
  };
}
