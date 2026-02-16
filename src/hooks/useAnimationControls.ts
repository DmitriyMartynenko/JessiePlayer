// useAnimationControls.ts
// ==================================================
// Hook for managing animation playback state
// ==================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimationControls, AnimationInfo } from "../players/PlayerContract";

export interface AnimationState {
  isPlaying: boolean;
  currentFrame: number;
  elapsedTime: number; // in seconds
  speed: number;
  info: AnimationInfo | null;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3] as const;
export type SpeedOption = typeof SPEED_OPTIONS[number];

export function useAnimationControls() {
  const [state, setState] = useState<AnimationState>({
    isPlaying: false,
    currentFrame: 0,
    elapsedTime: 0,
    speed: 1,
    info: null,
  });

  const controlsRef = useRef<AnimationControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // ─────────────────────────────────────────────
  // Register controls from player
  // ─────────────────────────────────────────────

  const registerControls = useCallback((controls: AnimationControls | null) => {
    controlsRef.current = controls;

    if (controls) {
      const info = controls.getInfo();
      setState((prev) => ({
        ...prev,
        info,
        currentFrame: controls.getCurrentFrame(),
        isPlaying: controls.getIsPlaying(),
      }));

      // Set up frame change callback
      controls.onFrameChange = (frame: number) => {
        const info = controlsRef.current?.getInfo();
        if (info) {
          const elapsedTime = frame / info.frameRate;
          setState((prev) => ({
            ...prev,
            currentFrame: frame,
            elapsedTime,
          }));
        }
      };

      // Set up play state change callback
      controls.onPlayStateChange = (isPlaying: boolean) => {
        setState((prev) => ({ ...prev, isPlaying }));
      };
    } else {
      setState({
        isPlaying: false,
        currentFrame: 0,
        elapsedTime: 0,
        speed: 1,
        info: null,
      });
    }
  }, []);

  // ─────────────────────────────────────────────
  // Playback controls
  // ─────────────────────────────────────────────

  const play = useCallback(() => {
    controlsRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    controlsRef.current?.pause();
  }, []);

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  // ─────────────────────────────────────────────
  // Timeline controls
  // ─────────────────────────────────────────────

  const seekToFrame = useCallback((frame: number) => {
    const info = controlsRef.current?.getInfo();
    if (!info) return;

    const clampedFrame = Math.max(0, Math.min(frame, info.totalFrames - 1));
    controlsRef.current?.seek(clampedFrame);

    const elapsedTime = clampedFrame / info.frameRate;
    setState((prev) => ({
      ...prev,
      currentFrame: clampedFrame,
      elapsedTime,
    }));
  }, []);

  const seekToTime = useCallback((timeInSeconds: number) => {
    const info = controlsRef.current?.getInfo();
    if (!info) return;

    const frame = Math.round(timeInSeconds * info.frameRate);
    seekToFrame(frame);
  }, [seekToFrame]);

  const seekToProgress = useCallback((progress: number) => {
    // progress is 0-1
    const info = controlsRef.current?.getInfo();
    if (!info) return;

    const frame = Math.round(progress * (info.totalFrames - 1));
    seekToFrame(frame);
  }, [seekToFrame]);

  // ─────────────────────────────────────────────
  // Speed control
  // ─────────────────────────────────────────────

  const setSpeed = useCallback((speed: number) => {
    controlsRef.current?.setSpeed(speed);
    setState((prev) => ({ ...prev, speed }));
  }, []);

  // ─────────────────────────────────────────────
  // Real-time updates (for smooth UI updates)
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!controlsRef.current || !state.isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const update = () => {
      const controls = controlsRef.current;
      if (!controls) return;

      const frame = controls.getCurrentFrame();
      const info = controls.getInfo();
      if (info) {
        const elapsedTime = frame / info.frameRate;
        setState((prev) => ({
          ...prev,
          currentFrame: frame,
          elapsedTime,
        }));
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [state.isPlaying]);

  return {
    state,
    actions: {
      play,
      pause,
      togglePlayPause,
      seekToFrame,
      seekToTime,
      seekToProgress,
      setSpeed,
      registerControls,
    },
    constants: {
      SPEED_OPTIONS,
    },
  };
}
