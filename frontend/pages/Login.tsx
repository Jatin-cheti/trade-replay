import { useState } from 'react';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import BrandLottie from '@/components/BrandLottie';

interface LoginProps {
  mode?: 'login' | 'signup';
}

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
  const { login, googleLogin } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(mode === 'signup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const showFullscreenLoader = isSubmitting || isGoogleLoading;

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
