"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";

function CountUp({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(reduceMotion ? value : 0);
  const text = useTransform(count, (v) => Math.round(v).toLocaleString("en-PH"));
  useEffect(() => {
    const controls = animate(count, value, { duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [count, value, reduceMotion]);
  return <motion.span>{text}</motion.span>;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="rounded-lg border bg-card/70 p-4 backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="tabular mt-2 text-2xl font-bold tracking-tight">
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {suffix}
      </p>
    </motion.div>
  );
}
