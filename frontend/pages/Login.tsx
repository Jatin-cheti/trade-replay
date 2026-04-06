import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import BrandLottie from '@/components/BrandLottie';

interface LoginProps {
  mode?: 'login' | 'signup';
}

type VantaBirdsOptions = {
  el: HTMLElement;
  mouseControls: boolean;
  touchControls: boolean;
  gyroControls: boolean;
  backgroundColor: number;
  color1: number;
  color2: number;
  colorMode: string;
  quantity: number;
  birdSize: number;
  wingSpan: number;
  speedLimit: number;
  separation: number;
  alignment: number;
  cohesion: number;
  scale: number;
  scaleMobile: number;
};

type VantaCloudsOptions = {
  el: HTMLElement;
  mouseControls: boolean;
  touchControls: boolean;
  gyroControls: boolean;
  backgroundColor: number;
  skyColor: number;
  cloudColor: number;
  cloudShadowColor: number;
  sunColor: number;
  sunGlareColor: number;
  sunlightColor: number;
  speed: number;
};

type VantaEffect = {
  destroy: () => void;
};

declare global {
  interface Window {
    VANTA?: {
      BIRDS?: (config: VantaBirdsOptions) => VantaEffect;
      CLOUDS?: (config: VantaCloudsOptions) => VantaEffect;
    };
  }
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-vanta-src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed loading ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.vantaSrc = src;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener('error', () => reject(new Error(`Failed loading ${src}`)), { once: true });
    document.head.appendChild(script);
  });

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 1,
            height: Math.random() * 4 + 1,
            background: `hsl(${217 + Math.random() * 45}, 80%, ${50 + Math.random() * 20}%)`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}

export default function Login({ mode = 'login' }: LoginProps) {
  const { theme } = useTheme();
  const { login, googleLogin } = useApp();
  const birdsRef = useRef<HTMLDivElement | null>(null);
  const cloudsRef = useRef<HTMLDivElement | null>(null);
  const birdsEffectRef = useRef<VantaEffect | null>(null);
  const cloudsEffectRef = useRef<VantaEffect | null>(null);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(mode === 'signup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const showFullscreenLoader = isSubmitting || isGoogleLoading;

  const initVantaBackground = useCallback(async (isDark: boolean) => {
    birdsEffectRef.current?.destroy();
    birdsEffectRef.current = null;
    cloudsEffectRef.current?.destroy();
    cloudsEffectRef.current = null;

    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js');
    await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.birds.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js'),
    ]);

    if (cloudsRef.current && window.VANTA?.CLOUDS) {
      cloudsEffectRef.current = window.VANTA.CLOUDS({
        el: cloudsRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        backgroundColor: isDark ? 0x050d1a : 0x8baac6,
        skyColor: isDark ? 0x0a1628 : 0x6b94b8,
        cloudColor: isDark ? 0x0e2244 : 0xb0cfea,
        cloudShadowColor: isDark ? 0x06101e : 0x5a7d9e,
        sunColor: isDark ? 0x1a3a66 : 0xffd080,
        sunGlareColor: isDark ? 0x0d2040 : 0xf5c860,
        sunlightColor: isDark ? 0x142d52 : 0xfff0c0,
        speed: 0.8,
      });
    }

    if (birdsRef.current && window.VANTA?.BIRDS) {
      birdsEffectRef.current = window.VANTA.BIRDS({
        el: birdsRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        backgroundColor: isDark ? 0x000000 : 0xffffff,
        color1: isDark ? 0x3b82f6 : 0x1d4ed8,
        color2: isDark ? 0x00d1ff : 0x0284c7,
        colorMode: 'varianceGradient',
        quantity: 4,
        birdSize: 1.1,
        wingSpan: 30,
        speedLimit: 4,
        separation: 25,
        alignment: 25,
        cohesion: 20,
        scale: 1.0,
        scaleMobile: 1.0,
      });
    }
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    initVantaBackground(isDark).catch(() => undefined);

    return () => {
      birdsEffectRef.current?.destroy();
      birdsEffectRef.current = null;
      cloudsEffectRef.current?.destroy();
      cloudsEffectRef.current = null;
    };
  }, [theme, initVantaBackground]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await login(email, password, isSignup);
    setIsSubmitting(false);
    if (result.ok) {
      toast.success(isSignup ? 'Account created successfully' : 'Login successful');
      navigate('/homepage');
      return;
    }
    toast.error(result.message ?? 'Authentication failed');
  };

  const handleGoogleLogin = async (credential?: string) => {
    if (!credential) return;
    setIsGoogleLoading(true);
    const result = await googleLogin(credential);
    setIsGoogleLoading(false);
    if (result.ok) {
      toast.success('Google login successful');
      navigate('/homepage');
      return;
    }
    toast.error(result.message ?? 'Google login failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center animated-gradient-bg relative overflow-hidden">
      <div ref={cloudsRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />
      <div
        ref={birdsRef}
        className={`fixed inset-0 z-0 pointer-events-none ${theme === 'dark' ? 'mix-blend-screen' : 'mix-blend-multiply'}`}
        style={{ background: 'transparent' }}
        aria-hidden="true"
      />

      {showFullscreenLoader && (
        <div className="absolute inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-strong rounded-xl px-6 py-4 flex items-center gap-3 max-w-[92vw]">
            <BrandLottie size={86} className="shrink-0" />
            <p className="text-sm text-foreground">Authenticating securely...</p>
          </div>
        </div>
      )}

      <Particles />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--neon-blue) / 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--neon-blue) / 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="glass-strong rounded-2xl p-8 w-full max-w-lg relative z-10 border border-primary/30"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 md:gap-4 mb-4">
            <BrandLottie size={84} className="shrink-0 drop-shadow-[0_0_16px_hsl(var(--neon-blue)/0.28)]" />
            <h1 className="font-display text-4xl md:text-[2.8rem] leading-none font-extrabold tracking-tight text-foreground whitespace-nowrap">Trade Replay</h1>
          </div>
          <p className="text-muted-foreground text-sm md:text-[0.95rem]">
            {isSignup ? 'Create your account to start trading' : 'Enter the simulation'}
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <label className="text-sm text-muted-foreground block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="trader@example.com"
              className="premium-input w-full px-4 py-3 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <label className="text-sm text-muted-foreground block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="premium-input w-full px-4 py-3 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
            />
          </motion.div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold glow-blue interactive-cta disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Please wait...' : (isSignup ? 'Create Account' : 'Login')}
          </motion.button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 text-muted-foreground bg-background">or</span>
          </div>
        </div>

        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          {isGoogleLoading && <p className="text-xs text-muted-foreground text-center mb-2">Verifying Google credential...</p>}
          <div className="w-full flex justify-center [&>div]:w-full [&_iframe]:!w-full [&_div[role=button]]:!w-full">
            <GoogleLogin
              onSuccess={(credentialResponse) => { void handleGoogleLogin(credentialResponse.credential); }}
              onError={() => undefined}
              theme="filled_black"
              text="continue_with"
              shape="pill"
              width="360"
            />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => {
              setIsSignup(!isSignup);
              navigate(isSignup ? '/login' : '/signup');
            }}
            className="text-primary hover:underline"
          >
            {isSignup ? 'Login' : 'Sign up'}
          </button>
        </motion.p>
      </motion.div>
    </div>
  );
}
