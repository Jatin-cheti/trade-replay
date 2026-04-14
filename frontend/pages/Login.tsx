import { useState } from 'react';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { useApp } from '@/context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import BrandLottie from '@/components/BrandLottie';
import PageBirdsCloudsBackground from '@/components/background/PageBirdsCloudsBackground';

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
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(mode === 'signup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const showFullscreenLoader = isSubmitting || isGoogleLoading;
  const redirectParam = searchParams.get('redirect');
  const redirectTarget = redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
    ? redirectParam
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await login(email, password, isSignup);
    setIsSubmitting(false);
    if (result.ok) {
      toast.success(isSignup ? 'Account created successfully' : 'Login successful');
      navigate(redirectTarget ?? '/homepage');
      return;
    }
    toast.error(result.message ?? 'Authentication failed');
  };

  const handleGoogleLogin = async (credential?: string) => {
    if (!credential) return;
    console.log("[AUTH] Google credential received, length:", credential.length, "prefix:", credential.slice(0, 20));
    setIsGoogleLoading(true);
    const result = await googleLogin(credential);
    setIsGoogleLoading(false);
    if (result.ok) {
      toast.success('Google login successful');
      navigate(redirectTarget ?? '/homepage');
      return;
    }
    toast.error(result.message ?? 'Google login failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center animated-gradient-bg relative overflow-hidden">
      <PageBirdsCloudsBackground />

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
        className="glass-strong rounded-2xl p-6 sm:p-8 w-full max-w-lg mx-4 relative z-10 border border-primary/30"
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
            <span className="rounded-md border border-primary/25 bg-background/85 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">or</span>
          </div>
        </div>

        <motion.div whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }} className="w-full">
          {isGoogleLoading && <p className="text-xs text-muted-foreground text-center mb-2">Verifying Google credential...</p>}
          <div data-testid="google-auth-shell" className="group w-full rounded-xl border border-primary/35 bg-[linear-gradient(180deg,hsl(var(--secondary)/0.38),hsl(var(--background)/0.55))] p-1.5 transition-all duration-200 hover:border-primary/60 hover:shadow-[0_0_18px_hsl(var(--neon-blue)/0.22)] active:scale-[0.995]">
            <div className="w-full overflow-hidden rounded-lg bg-background/35 p-0.5">
              <div data-testid="google-auth-frame-wrap" className="w-full max-w-full overflow-hidden rounded-lg [&>div]:!w-full [&_iframe]:!block [&_iframe]:!h-[52px] [&_iframe]:!max-w-full [&_iframe]:!w-full [&_iframe]:!rounded-lg [&_div[role=button]]:!flex [&_div[role=button]]:!h-[52px] [&_div[role=button]]:!w-full [&_div[role=button]]:!max-w-full [&_div[role=button]]:!items-center [&_div[role=button]]:!justify-center [&_div[role=button]]:!gap-3 [&_div[role=button]]:!overflow-hidden [&_div[role=button]]:!px-4 [&_div[role=button]]:!py-3 [&_div[role=button]]:!rounded-lg [&_div[role=button]]:!text-[0.95rem] [&_div[role=button]]:!font-medium [&_div[role=button]]:!tracking-wide">
                <GoogleLogin
                  onSuccess={(credentialResponse) => { void handleGoogleLogin(credentialResponse.credential); }}
                  onError={() => {
                    console.error("[AUTH] Google OAuth button reported error (client-side). Check: authorized JavaScript origins include this domain in Google Cloud Console.");
                    toast.error('Google sign-in failed. Please try again or use email/password.');
                  }}
                  theme="outline"
                  text="continue_with"
                  shape="rectangular"
                  size="large"
                  logo_alignment="left"
                  width="100%"
                />
              </div>
            </div>
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
              const nextPath = isSignup ? '/login' : '/signup';
              if (redirectTarget) {
                navigate(`${nextPath}?redirect=${encodeURIComponent(redirectTarget)}`);
                return;
              }
              navigate(nextPath);
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
