import { ServerCrash } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/primitives';

/**
 * Shown when a page cannot reach the CSMS at all. Distinguishes "the backend is
 * unreachable" from "there is no data yet", which look identical otherwise.
 */
export function BackendDown({ what = 'the CSMS backend' }: { what?: string }) {
  return (
    <Card>
      <EmptyState
        icon={<ServerCrash className="h-8 w-8" />}
        title={`Cannot reach ${what}`}
        description="The request failed or your session was rejected. Check that the CSMS is running and that CSMS_API_URL points at it."
      />
    </Card>
  );
}
