import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Activity, TrendingUp, GitCompare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DashboardHero() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-8 md:p-12 mb-8"
      style={{
        background: 'var(--gradient-hero)',
        boxShadow: 'var(--shadow-large)',
      }}
    >
      {/* Animated particles background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-accent/10 rounded-full blur-3xl"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4"
        >
          QoSCollab Performance Dashboard
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-primary-foreground/90 mb-8 max-w-2xl"
        >
          Monitor, compare, and optimize your web services in real-time.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap gap-4"
        >
          <Button
            onClick={() => navigate('/qos/run-test')}
            size="lg"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg"
          >
            <Activity className="mr-2 h-5 w-5" />
            Run Global Test
          </Button>
          <Button
            onClick={() => navigate('/recommendations')}
            size="lg"
            variant="outline"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <TrendingUp className="mr-2 h-5 w-5" />
            View Recommendations
          </Button>
          <Button
            onClick={() => navigate('/compare-services')}
            size="lg"
            variant="outline"
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <GitCompare className="mr-2 h-5 w-5" />
            Compare Services
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
