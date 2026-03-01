"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Cross1Icon } from "@radix-ui/react-icons";
import { Kbd } from "./ui/kbd";
import Link from "next/link";

const ChromeIcon = ({ className }: { className?: string }) => (
    <svg
        fill="currentColor"
        width="20"
        height="20"
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <path d="M188.8,255.93A67.2,67.2,0,1,0,256,188.75,67.38,67.38,0,0,0,188.8,255.93Z" />
        <path d="M476.75,217.79s0,0,0,.05a206.63,206.63,0,0,0-7-28.84h-.11a202.16,202.16,0,0,1,7.07,29h0a203.5,203.5,0,0,0-7.07-29H314.24c19.05,17,31.36,40.17,31.36,67.05a86.55,86.55,0,0,1-12.31,44.73L231,478.45a2.44,2.44,0,0,1,0,.27V479h0v-.26A224,224,0,0,0,256,480c6.84,0,13.61-.39,20.3-1a222.91,222.91,0,0,0,29.78-4.74C405.68,451.52,480,362.4,480,255.94A225.25,225.25,0,0,0,476.75,217.79Z" />
        <path d="M256,345.5c-33.6,0-61.6-17.91-77.29-44.79L76,123.05l-.14-.24A224,224,0,0,0,207.4,474.55l0-.05,77.69-134.6A84.13,84.13,0,0,1,256,345.5Z" />
        <path d="M91.29,104.57l77.35,133.25A89.19,89.19,0,0,1,256,166H461.17a246.51,246.51,0,0,0-25.78-43.94l.12.08A245.26,245.26,0,0,1,461.17,166h.17a245.91,245.91,0,0,0-25.66-44,2.63,2.63,0,0,1-.35-.26A223.93,223.93,0,0,0,91.14,104.34l.14.24Z" />
    </svg>
);

const DURATION = 0.3;
const DELAY = DURATION;
const EASE_OUT = "easeOut";
const EASE_OUT_OPACITY = [0.25, 0.46, 0.45, 0.94] as const;
const SPRING = {
    type: "spring" as const,
    stiffness: 60,
    damping: 10,
    mass: 0.8,
};

export const Newsletter = () => {
    const [showDemo, setShowDemo] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const shouldReduceMotion = useReducedMotion();

    const landingContainerVariants = {
        hidden: { opacity: shouldReduceMotion ? 1 : 0 },
        visible: {
            opacity: 1,
            transition: shouldReduceMotion
                ? undefined
                : {
                      delayChildren: 0.08,
                      staggerChildren: 0.1,
                  },
        },
    };

    const landingItemVariants = {
        hidden: {
            opacity: shouldReduceMotion ? 1 : 0,
            y: shouldReduceMotion ? 0 : 22,
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.45,
                ease: EASE_OUT_OPACITY,
            },
        },
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowDemo(false);
                setShowSetup(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return (
        <>
            <motion.div
                initial="hidden"
                animate="visible"
                variants={landingContainerVariants}
                className="flex overflow-hidden relative flex-col gap-4 justify-center items-center pt-10 w-full h-full short:lg:pt-10 pb-footer-safe-area 2xl:pt-footer-safe-area px-sides short:lg:gap-4 lg:gap-8"
            >
                <motion.div
                    layout="position"
                    variants={landingItemVariants}
                    transition={{ duration: DURATION, ease: EASE_OUT }}
                    className={cn(
                        "transition-all duration-300",
                        (showDemo || showSetup) && "blur-md opacity-50",
                    )}
                >
                    <h1 className="font-serif text-5xl italic short:lg:text-8xl sm:text-8xl lg:text-9xl text-foreground">
                        getintro.cc
                    </h1>
                </motion.div>

                <motion.div
                    variants={landingItemVariants}
                    className={cn(
                        "flex flex-col items-center min-h-0 shrink transition-all duration-300",
                        (showDemo || showSetup) && "blur-md opacity-50",
                    )}
                >
                    <AnimatePresence mode="popLayout" propagate>
                        <motion.div
                            key="newsletter"
                            initial={shouldReduceMotion ? false : "hidden"}
                            animate="visible"
                            exit="exit"
                            variants={{
                                visible: {
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                    transition: {
                                        delay: DELAY,
                                        duration: DURATION,
                                        ease: EASE_OUT,
                                    },
                                },
                                hidden: {
                                    opacity: shouldReduceMotion ? 1 : 0,
                                    y: shouldReduceMotion ? 0 : 20,
                                    scale: 0.9,
                                    transition: { duration: DURATION, ease: EASE_OUT },
                                },
                                exit: {
                                    y: -150,
                                    scale: 0.9,
                                    transition: { duration: DURATION, ease: EASE_OUT },
                                },
                            }}
                        >
                            <div className="flex flex-col gap-4 w-full max-w-xl md:gap-6 lg:gap-8">
                                <motion.p
                                    initial={shouldReduceMotion ? false : "hidden"}
                                    animate="visible"
                                    variants={landingItemVariants}
                                    exit={{
                                        opacity: 0,
                                        transition: { duration: DURATION, ease: EASE_OUT_OPACITY },
                                    }}
                                    className="text-base short:lg:text-lg sm:text-lg lg:text-xl !leading-[1.3] font-medium text-center text-foreground text-pretty"
                                >
                                    Instantly connect with founders. One click in the browser
                                    toolbar finds their contact and drafts your outreach in Gmail.
                                    Powered by your Mistral AI and RocketReach API key.
                                </motion.p>
                            </div>
                        </motion.div>

                        <motion.div
                            layout="position"
                            transition={SPRING}
                            key="button"
                            initial={shouldReduceMotion ? false : "hidden"}
                            animate="visible"
                            variants={landingItemVariants}
                            className="mt-6 flex flex-col items-center gap-4"
                        >
                            <Button className={cn("relative px-8 gap-2")} shine>
                                <ChromeIcon className="size-5" />
                                <span className="inline-block">Download Extension</span>
                                <Kbd className="ml-2 bg-foreground/30 text-foreground">enter</Kbd>
                            </Button>

                            <motion.div variants={landingItemVariants} className="flex items-center gap-6">
                                <button
                                    onClick={() => setShowDemo(true)}
                                    className="text-sm font-medium text-foreground/80 hover:text-foreground underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none"
                                >
                                    Watch demo
                                </button>

                                <button
                                    onClick={() => setShowSetup(true)}
                                    className="text-sm font-medium text-foreground/80 hover:text-foreground underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none"
                                >
                                    How to setup
                                </button>

                                <Link
                                    href="https://github.com/emilianscheel/getintro.cc"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <button className="text-sm font-medium text-foreground/80 hover:text-foreground underline underline-offset-4 transition-colors outline-none focus:outline-none focus-visible:outline-none">
                                        View on GitHub
                                    </button>
                                </Link>
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </motion.div>

            {/* Demo Video Overlay */}
            <AnimatePresence>
                {showDemo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
                        onClick={() => setShowDemo(false)}
                    >
                        <button className="absolute top-6 right-6 z-10 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/20 transition-colors backdrop-blur-sm outline-none focus:outline-none">
                            <Cross1Icon className="size-4" />
                            <Kbd className="bg-white/20 text-white/80">esc</Kbd>
                        </button>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-[95vw] md:w-[92vw] lg:w-[72vw] max-w-6xl rounded-2xl overflow-hidden bg-white/20 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 cursor-default"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src="/demo.gif"
                                alt="Demo video showing how getintro.cc works"
                                width={1882}
                                height={1242}
                                className="w-full h-auto"
                                loading="eager"
                                unoptimized
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Setup Modal */}
            <AnimatePresence>
                {showSetup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
                        onClick={() => setShowSetup(false)}
                    >
                        <button className="absolute top-6 right-6 z-10 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/20 transition-colors backdrop-blur-sm outline-none focus:outline-none">
                            <Cross1Icon className="size-4" />
                            <Kbd className="bg-white/20 text-white/80">esc</Kbd>
                        </button>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-lg rounded-2xl overflow-hidden bg-white/20 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 p-6 cursor-default"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-full space-y-3">
                                <div className="flex items-center gap-3 text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-medium text-black">
                                        1
                                    </span>
                                    <span>Download</span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-medium text-black">
                                        2
                                    </span>
                                    <span>Install</span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-medium text-black">
                                        3
                                    </span>
                                    <span>Login with Google</span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-medium text-black">
                                        4
                                    </span>
                                    <span>
                                        <a
                                            href="https://rocketreach.co/api"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline underline-offset-4 hover:text-white/80"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Get
                                        </a>{" "}
                                        and paste RocketReach API key
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-medium text-black">
                                        5
                                    </span>
                                    <span>
                                        <a
                                            href="https://console.mistral.ai/api-keys"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline underline-offset-4 hover:text-white/80"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Get
                                        </a>{" "}
                                        and paste Mistral API key
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-medium text-black">
                                        6
                                    </span>
                                    <span>Get intro</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
