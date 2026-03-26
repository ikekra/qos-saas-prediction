import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTokenUsage } from '@/hooks/useTokenUsage';

type TokenWidgetProps = {
  showDetails?: boolean;
};

export function TokenWidget({ showDetails = false }: TokenWidgetProps) {
  const { tokenUsage, usagePercent, liveStatus, balanceUpdatedAt } = useTokenUsage();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
          {new Intl.NumberFormat('en-IN').format(tokenUsage.balance)} tokens
        </Badge>
        <span className="text-xs text-muted-foreground">
          {liveStatus === 'live' ? 'Live' : liveStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
        </span>
      </div>
      {showDetails && (
        <>
          <Progress value={usagePercent} />
          <p className="text-xs text-muted-foreground">
            Updated {balanceUpdatedAt ? new Date(balanceUpdatedAt).toLocaleTimeString() : 'just now'}
          </p>
        </>
      )}
    </div>
  );
}
