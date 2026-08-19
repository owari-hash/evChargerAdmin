import { ServerCrash } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/primitives';

/**
 * Shown when a page cannot reach the CSMS at all. Distinguishes "the backend is
 * unreachable" from "there is no data yet", which look identical otherwise.
 */
export function BackendDown({ what = 'CSMS сервер' }: { what?: string }) {
  return (
    <Card>
      <EmptyState
        icon={<ServerCrash className="h-8 w-8" />}
        title={`${what}-тэй холбогдож чадсангүй`}
        description="Хүсэлт амжилтгүй болсон эсвэл таны нэвтрэлт хүчингүй байна. CSMS ажиллаж байгаа эсэх, CSMS_API_URL зөв заасан эсэхийг шалгана уу."
      />
    </Card>
  );
}
