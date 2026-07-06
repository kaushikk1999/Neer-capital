export const fadeUp = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } };
export const staggerChildren = { initial: {}, animate: { transition: { staggerChildren: 0.08 } } };
export const cardHover = { whileHover: { y: -2, scale: 1.01 }, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } };
export const viewportOnce = { once: true, amount: 0.25 };
