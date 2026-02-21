import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGuide } from "../../hooks/useGuide";
import { guides } from "../../data/guides";
import { GuideSpotlight } from "./GuideSpotlight";
import { GuideTooltip } from "./GuideTooltip";

export function GuideTour() {
  const { t } = useTranslation("guide");
  const {
    activeGuideId,
    activeStepIndex,
    nextStep,
    prevStep,
    skipGuide,
    isGuideActive,
  } = useGuide();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [effectivePlacement, setEffectivePlacement] = useState<
    "top" | "bottom" | "left" | "right"
  >("bottom");
  const prevActiveElementRef = useRef<HTMLElement | null>(null);

  const calculatePosition = useCallback(() => {
    if (!activeGuideId) return;

    const guide = guides[activeGuideId];
    if (!guide) return;

    const step = guide.steps[activeStepIndex];
    if (!step) return;

    const el = document.querySelector(
      step.targetSelector,
    ) as HTMLElement | null;
    if (!el) return;

    // Scroll element into view if needed
    const rect = el.getBoundingClientRect();
    const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!isInView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Recalculate after scroll
      requestAnimationFrame(() => {
        const newRect = el.getBoundingClientRect();
        updatePositions(newRect, step.placement || "bottom");
      });
      return;
    }

    updatePositions(rect, step.placement || "bottom");
  }, [activeGuideId, activeStepIndex]);

  const updatePositions = useCallback(
    (
      rect: DOMRect,
      preferredPlacement: "top" | "bottom" | "left" | "right",
    ) => {
      setTargetRect(rect);

      // Set data-guide-active on target element
      const allActive = document.querySelectorAll("[data-guide-active]");
      allActive.forEach((el) => el.removeAttribute("data-guide-active"));

      if (activeGuideId) {
        const guide = guides[activeGuideId];
        if (guide) {
          const step = guide.steps[activeStepIndex];
          if (step) {
            const el = document.querySelector(
              step.targetSelector,
            ) as HTMLElement | null;
            if (el) {
              el.setAttribute("data-guide-active", "true");
              prevActiveElementRef.current = el;
            }
          }
        }
      }

      const tooltipWidth = 320;
      const tooltipHeight = 180;
      const gap = 16;
      const padding = 16;

      let placement = preferredPlacement;
      let top = 0;
      let left = 0;

      // Try preferred placement, then fallback
      if (placement === "bottom") {
        top = rect.bottom + gap;
        left = rect.left;
        if (top + tooltipHeight > window.innerHeight) {
          placement = "top";
        }
      }

      if (placement === "top") {
        top = rect.top - tooltipHeight - gap;
        left = rect.left;
        if (top < 0) {
          top = rect.bottom + gap;
          placement = "bottom";
        }
      }

      if (placement === "left") {
        top = rect.top;
        left = rect.left - tooltipWidth - gap;
        if (left < 0) {
          left = rect.right + gap;
          placement = "right";
        }
      }

      if (placement === "right") {
        top = rect.top;
        left = rect.right + gap;
        if (left + tooltipWidth > window.innerWidth) {
          left = rect.left - tooltipWidth - gap;
          placement = "left";
        }
      }

      // Ensure tooltip stays within viewport
      left = Math.max(
        padding,
        Math.min(left, window.innerWidth - tooltipWidth - padding),
      );
      top = Math.max(
        padding,
        Math.min(top, window.innerHeight - tooltipHeight - padding),
      );

      setTooltipPos({ top, left });
      setEffectivePlacement(placement);
    },
    [activeGuideId, activeStepIndex],
  );

  // Recalculate on step change
  useEffect(() => {
    if (!isGuideActive) {
      // Clean up data-guide-active when guide closes
      if (prevActiveElementRef.current) {
        prevActiveElementRef.current.removeAttribute("data-guide-active");
        prevActiveElementRef.current = null;
      }
      return;
    }

    // Small delay to allow DOM to settle
    const timer = setTimeout(calculatePosition, 100);
    return () => clearTimeout(timer);
  }, [isGuideActive, activeStepIndex, calculatePosition]);

  // Handle resize and scroll
  useEffect(() => {
    if (!isGuideActive) return;

    const handleResize = () => calculatePosition();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isGuideActive, calculatePosition]);

  // Handle escape key
  useEffect(() => {
    if (!isGuideActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skipGuide();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        nextStep();
      } else if (e.key === "ArrowLeft") {
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGuideActive, skipGuide, nextStep, prevStep]);

  if (!isGuideActive || !activeGuideId) return null;

  const guide = guides[activeGuideId];
  if (!guide) return null;

  const step = guide.steps[activeStepIndex];
  if (!step) return null;

  const title = t(step.titleKey.replace("guide:", ""));
  const description = t(step.descriptionKey.replace("guide:", ""));

  if (!targetRect) return null;

  return (
    <>
      <GuideSpotlight targetRect={targetRect} />
      <GuideTooltip
        title={title}
        description={description}
        currentStep={activeStepIndex + 1}
        totalSteps={guide.steps.length}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipGuide}
        isFirst={activeStepIndex === 0}
        isLast={activeStepIndex === guide.steps.length - 1}
        position={tooltipPos}
        placement={effectivePlacement}
      />
    </>
  );
}
