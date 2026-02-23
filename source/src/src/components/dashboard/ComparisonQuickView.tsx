import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitCompare, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ComparisonQuickView() {
  const navigate = useNavigate();

  return (
    <Card className="gradient-card shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          Service Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <div className="mb-4">
            <GitCompare className="h-16 w-16 mx-auto text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-6">
            Compare multiple services side-by-side to find the best fit for your needs.
          </p>
          <Button
            onClick={() => navigate('/compare-services')}
            className="w-full"
            size="lg"
          >
            Go to Full Compare
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  );
}
