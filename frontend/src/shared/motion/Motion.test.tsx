import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedHeading, FadeIn } from "./Motion";

function mockMotionPreference(reduced: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: reduced,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("shared motion", () => {
  it("reveals content after the configured delay", () => {
    vi.useFakeTimers();
    mockMotionPreference(false);
    render(<FadeIn delay={800}>实时态势</FadeIn>);
    const wrapper = screen.getByText("实时态势");
    expect(wrapper?.className).not.toContain("visible");
    act(() => vi.advanceTimersByTime(800));
    expect(wrapper?.className).toContain("visible");
  });

  it("exposes the complete heading to assistive technology", () => {
    mockMotionPreference(false);
    render(<AnimatedHeading text={"提前看见\n选择更稳"} />);
    expect(screen.getByRole("heading", { name: "提前看见 选择更稳" })).toBeInTheDocument();
  });

  it("skips delayed animation when reduced motion is requested", () => {
    mockMotionPreference(true);
    render(<FadeIn delay={2000}>静态内容</FadeIn>);
    expect(screen.getByText("静态内容").className).toContain("visible");
  });
});
