'use client';

import * as React from 'react';
import {
  Activity,
  AlertTriangle,
  Battery,
  BatteryCharging,
  Car,
  CheckCircle2,
  Cpu,
  Eye,
  Layers,
  Play,
  PlayCircle,
  Plug,
  RefreshCw,
  Search,
  Sliders,
  Square,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import useSWR from 'swr';
import { Badge, Button, Card, CardBody, CardHeader, Dot, Input } from '@/components/ui/primitives';
import { Table, TableWrap, TBody, TH, THead } from '@/components/ui/table';
import { apiUrl, fetcher } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

// ============================================================================
// Vehicle Presets
// ============================================================================

interface VehiclePreset {
  id: string;
  name: string;
  vin: string;
  batteryKwh: number;
  maxPowerKw: number;
  initialSoc: number;
}

const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: 'byd',
    name: 'BYD Atto 3',
    vin: 'LZY1234567890ABCD',
    batteryKwh: 60.48,
    maxPowerKw: 88,
    initialSoc: 25,
  },
  {
    id: 'vw',
    name: 'VW ID.4 Prime',
    vin: 'LFV2A21K2N0123456',
    batteryKwh: 84.0,
    maxPowerKw: 100,
    initialSoc: 18,
  },
  {
    id: 'tesla',
    name: 'Tesla Model Y LR',
    vin: '5YJ3E1EB8LF123456',
    batteryKwh: 75.0,
    maxPowerKw: 120,
    initialSoc: 30,
  },
  {
    id: 'custom',
    name: 'Өөр машин / Custom',
    vin: 'CUSTOMVIN12345678',
    batteryKwh: 70.0,
    maxPowerKw: 60,
    initialSoc: 40,
  },
];

interface OcppLogEntry {
  id: string;
  time: string;
  direction: 'IN' | 'OUT';
  action?: string;
  messageType: number;
  payload: unknown;
}

interface VehicleDetectionRecord {
  id: string;
  _id?: string;
  cpId: string;
  connectorId?: number;
  vin?: string;
  model?: string;
  source: string;
  protocolMessage?: string;
  batteryCapacity?: number;
  soc?: number;
  maxPowerKw?: number;
  transactionId?: number;
  remoteAddress?: string;
  rawPayload?: unknown;
  detectedAt: string;
}

// ============================================================================
// Main Simulator View Component
// ============================================================================

export function SimulatorView() {
  const [activeTab, setActiveTab] = React.useState<'single' | 'fleet' | 'detections'>('single');

  // Station Connection state
  const [cpId, setCpId] = React.useState('CP-SIM-001');
  const [wsUrl, setWsUrl] = React.useState('');
  const [authKey, setAuthKey] = React.useState('');
  const [connectorId, setConnectorId] = React.useState(1);
  const [idTag, setIdTag] = React.useState('TAG-0001');

  // Connection & status
  const [connected, setConnected] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [stationStatus, setStationStatus] = React.useState<
    'Unavailable' | 'Available' | 'Preparing' | 'Charging' | 'Finishing' | 'Faulted'
  >('Unavailable');

  // Vehicle selection
  const [selectedPresetId, setSelectedPresetId] = React.useState('byd');
  const [customCar, setCustomCar] = React.useState<VehiclePreset>(VEHICLE_PRESETS[0]!);

  // Active Transaction state
  const [activeTxId, setActiveTxId] = React.useState<number | null>(null);
  const [currentSoc, setCurrentSoc] = React.useState(25);
  const [currentPowerKw, setCurrentPowerKw] = React.useState(88);
  const [meterWh, setMeterWh] = React.useState(100_000);
  const [handshakeDone, setHandshakeDone] = React.useState(false);

  // Live Logs
  const [logs, setLogs] = React.useState<OcppLogEntry[]>([]);

  // Fleet Load Testing state
  const [fleetCount, setFleetCount] = React.useState(10);
  const [fleetRunning, setFleetRunning] = React.useState(false);
  const [fleetStats, setFleetStats] = React.useState({
    totalConnected: 0,
    activeSessions: 0,
    totalFrames: 0,
    errors: 0,
  });

  // Refs for socket & timers
  const wsRef = React.useRef<WebSocket | null>(null);
  const pendingMapRef = React.useRef<Map<string, (res: unknown) => void>>(new Map());
  const heartbeatTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const meterTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const fleetSocketsRef = React.useRef<WebSocket[]>([]);

  // Auto-detect default WS URL on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const proto = isHttps ? 'wss:' : 'ws:';
      // In development, backend runs on 3000; in production, reverse-proxied on current host
      const host =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? `${window.location.hostname}:3000`
          : window.location.host;
      setWsUrl(`${proto}//${host}/ocpp`);
    }
  }, []);

  // Update custom car when preset changes
  React.useEffect(() => {
    const found = VEHICLE_PRESETS.find((p) => p.id === selectedPresetId);
    if (found) {
      setCustomCar({ ...found });
      setCurrentSoc(found.initialSoc);
      setCurrentPowerKw(found.maxPowerKw);
    }
  }, [selectedPresetId]);

  const addLog = React.useCallback(
    (direction: 'IN' | 'OUT', messageType: number, action: string | undefined, payload: unknown) => {
      const entry: OcppLogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        time: new Date().toLocaleTimeString(),
        direction,
        messageType,
        action,
        payload,
      };
      setLogs((prev) => [entry, ...prev.slice(0, 99)]);
    },
    [],
  );

  // Send an OCPP CALL frame
  const callOcpp = React.useCallback(
    <T = Record<string, unknown>,>(action: string, payload: unknown): Promise<T> => {
      const id = Math.random().toString(36).substring(2, 10);
      return new Promise((resolve) => {
        pendingMapRef.current.set(id, resolve as (res: unknown) => void);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify([2, id, action, payload]));
          addLog('OUT', 2, action, payload);
        }
      });
    },
    [addLog],
  );

  // Connect to CSMS WebSocket
  const handleConnect = async () => {
    if (!wsUrl || !cpId) {
      toast.error('Станцын дугаар болон WebSocket URL-ээ оруулна уу');
      return;
    }

    setConnecting(true);
    try {
      const endpoint = `${wsUrl.replace(/\/$/, '')}/${encodeURIComponent(cpId)}`;
      const ws = new WebSocket(endpoint, ['ocpp1.6']);
      wsRef.current = ws;

      ws.onopen = async () => {
        setConnected(true);
        setConnecting(false);
        toast.success(`Станц ${cpId} холбогдлоо!`);

        // 1. BootNotification
        const boot = await callOcpp<{ status: string; interval: number }>('BootNotification', {
          chargePointVendor: 'EPlug-SimWeb',
          chargePointModel: 'FastDC-120kW',
          chargePointSerialNumber: `SN-${cpId}`,
          firmwareVersion: '2.4.0',
        });

        // 2. Heartbeat interval
        const interval = (boot.interval || 300) * 1000;
        heartbeatTimerRef.current = setInterval(() => {
          void callOcpp('Heartbeat', {});
        }, interval);

        // 3. StatusNotification (Available)
        await callOcpp('StatusNotification', {
          connectorId: 0,
          errorCode: 'NoError',
          status: 'Available',
          timestamp: new Date().toISOString(),
        });

        await callOcpp('StatusNotification', {
          connectorId,
          errorCode: 'NoError',
          status: 'Available',
          timestamp: new Date().toISOString(),
        });
        setStationStatus('Available');
      };

      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data) as unknown[];
          const [type, msgId] = frame as [number, string];

          if (type === 3) {
            // CALLRESULT
            addLog('IN', 3, undefined, frame[2]);
            const resolver = pendingMapRef.current.get(msgId);
            if (resolver) {
              resolver(frame[2]);
              pendingMapRef.current.delete(msgId);
            }
          } else if (type === 4) {
            // CALLERROR
            addLog('IN', 4, undefined, frame[2]);
            const resolver = pendingMapRef.current.get(msgId);
            if (resolver) {
              resolver({});
              pendingMapRef.current.delete(msgId);
            }
          } else if (type === 2) {
            // CALL from Central System
            const action = frame[2] as string;
            const payload = (frame[3] ?? {}) as Record<string, unknown>;
            addLog('IN', 2, action, payload);

            let replyPayload: unknown = { status: 'Accepted' };
            if (action === 'RemoteStartTransaction') {
              replyPayload = { status: 'Accepted' };
              toast.info('Алсаас эхлүүлэх (RemoteStart) хүсэлт ирлээ!');
              setTimeout(() => {
                void handlePlugIn().then(() => handleStartCharging(String(payload.idTag || idTag)));
              }, 500);
            } else if (action === 'RemoteStopTransaction') {
              replyPayload = { status: 'Accepted' };
              toast.info('Алсаас зогсоох (RemoteStop) хүсэлт ирлээ!');
              setTimeout(() => void handleStopCharging('Remote'), 500);
            } else if (action === 'GetConfiguration') {
              replyPayload = {
                configurationKey: [
                  { key: 'HeartbeatInterval', readonly: false, value: '300' },
                  { key: 'NumberOfConnectors', readonly: true, value: '2' },
                ],
                unknownKey: [],
              };
            }

            ws.send(JSON.stringify([3, msgId, replyPayload]));
            addLog('OUT', 3, action, replyPayload);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        setStationStatus('Unavailable');
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (meterTimerRef.current) clearInterval(meterTimerRef.current);
        toast.info('Холболт салсан');
      };

      ws.onerror = (e) => {
        setConnecting(false);
        toast.error('WebSocket холболт үүсгэхэд алдаа гарлаа');
        console.error(e);
      };
    } catch (err) {
      setConnecting(false);
      toast.error((err as Error).message);
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setStationStatus('Unavailable');
    setActiveTxId(null);
  };

  // Step 1: Plug in vehicle & Send GB/T DataTransfer Handshake
  const handlePlugIn = async () => {
    if (!connected) {
      toast.error('Эхлээд станцыг холбоно уу!');
      return;
    }

    // 1. StatusNotification -> Preparing
    await callOcpp('StatusNotification', {
      connectorId,
      errorCode: 'NoError',
      status: 'Preparing',
      timestamp: new Date().toISOString(),
    });
    setStationStatus('Preparing');

    // 2. DataTransfer handshake with vehicle info
    toast.info(`Кабель залгагдлаа. Машины мэдээллийг илгээж байна... (VIN: ${customCar.vin})`);
    const dtResult = await callOcpp<{ status: string }>('DataTransfer', {
      vendorId: 'GBT',
      messageId: 'BRM',
      data: JSON.stringify({
        vin: customCar.vin,
        carModel: customCar.name,
        batteryCapacity: customCar.batteryKwh,
        soc: currentSoc,
        maxPowerKw: customCar.maxPowerKw,
      }),
    });

    if (dtResult.status === 'Accepted') {
      setHandshakeDone(true);
      toast.success('✓ Машины мэдээлэл (DataTransfer) амжилттай баталгаажлаа!');
    } else {
      toast.warning(`DataTransfer хариу: ${dtResult.status}`);
    }
  };

  // Step 2: Start Charging
  const handleStartCharging = async (useTag = idTag) => {
    if (!connected) return;

    // Authorize
    toast.info(`Карт / Хэрэглэгч шалгаж байна: ${useTag}...`);
    const auth = await callOcpp<{ idTagInfo: { status: string } }>('Authorize', { idTag: useTag });

    if (auth.idTagInfo?.status !== 'Accepted') {
      toast.error(`Зөвшөөрөл олгогдсонгүй: ${auth.idTagInfo?.status}`);
      return;
    }

    // StartTransaction
    const start = await callOcpp<{ transactionId: number }>('StartTransaction', {
      connectorId,
      idTag: useTag,
      meterStart: meterWh,
      timestamp: new Date().toISOString(),
    });

    const txId = start.transactionId;
    setActiveTxId(txId);

    await callOcpp('StatusNotification', {
      connectorId,
      errorCode: 'NoError',
      status: 'Charging',
      timestamp: new Date().toISOString(),
    });
    setStationStatus('Charging');
    toast.success(`Цэнэглэлт эхэллээ! Гүйлгээ #${txId}`);

    // Start live meter ticks every 5 seconds
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
    meterTimerRef.current = setInterval(() => {
      setMeterWh((prevMeter) => {
        // Power tapers above 80% SoC
        const power = currentSoc > 80 ? Math.max(15, customCar.maxPowerKw * (1 - (currentSoc - 80) / 25)) : customCar.maxPowerKw;
        setCurrentPowerKw(Math.round(power));

        const addedWh = Math.round((power * 1000 * 5) / 3600);
        const newMeter = prevMeter + addedWh;

        setCurrentSoc((prevSoc) => {
          const addedSoc = (addedWh / (customCar.batteryKwh * 1000)) * 100;
          const newSoc = Math.min(100, Math.round((prevSoc + addedSoc) * 10) / 10);

          void callOcpp('MeterValues', {
            connectorId,
            transactionId: txId,
            meterValue: [
              {
                timestamp: new Date().toISOString(),
                sampledValue: [
                  {
                    value: String(newMeter),
                    measurand: 'Energy.Active.Import.Register',
                    unit: 'Wh',
                    context: 'Sample.Periodic',
                  },
                  {
                    value: String(Math.round(power * 1000)),
                    measurand: 'Power.Active.Import',
                    unit: 'W',
                  },
                  {
                    value: String(Math.round(newSoc)),
                    measurand: 'SoC',
                    unit: 'Percent',
                  },
                ],
              },
            ],
          });

          return newSoc;
        });

        return newMeter;
      });
    }, 5000);
  };

  // Step 3: Stop Charging
  const handleStopCharging = async (reason = 'Local') => {
    if (!activeTxId || !connected) return;

    if (meterTimerRef.current) clearInterval(meterTimerRef.current);

    await callOcpp('StatusNotification', {
      connectorId,
      errorCode: 'NoError',
      status: 'Finishing',
      timestamp: new Date().toISOString(),
    });
    setStationStatus('Finishing');

    await callOcpp('StopTransaction', {
      transactionId: activeTxId,
      idTag,
      meterStop: meterWh,
      timestamp: new Date().toISOString(),
      reason,
    });

    setActiveTxId(null);
    toast.success('Цэнэглэлт зогслоо');

    // Return to Available after short delay
    setTimeout(async () => {
      await callOcpp('StatusNotification', {
        connectorId,
        errorCode: 'NoError',
        status: 'Available',
        timestamp: new Date().toISOString(),
      });
      setStationStatus('Available');
      setHandshakeDone(false);
    }, 1500);
  };

  // Fault Injection
  const handleInjectFault = async (errorCode: string) => {
    if (!connected) return;
    await callOcpp('StatusNotification', {
      connectorId,
      errorCode,
      status: 'Faulted',
      info: 'Simulated hardware alert',
      timestamp: new Date().toISOString(),
    });
    setStationStatus('Faulted');
    toast.error(`Алдааны төлөв илгээгдлээ: ${errorCode}`);
  };

  const handleClearFault = async () => {
    if (!connected) return;
    await callOcpp('StatusNotification', {
      connectorId,
      errorCode: 'NoError',
      status: 'Available',
      timestamp: new Date().toISOString(),
    });
    setStationStatus('Available');
    toast.success('Алдааг арилгаж Available төлөвт орлоо');
  };

  // ==========================================================================
  // Fleet Stress Testing Logic
  // ==========================================================================

  const startFleetTest = async () => {
    if (!wsUrl) {
      toast.error('WebSocket URL-ээ оруулна уу');
      return;
    }

    setFleetRunning(true);
    setFleetStats({ totalConnected: 0, activeSessions: 0, totalFrames: 0, errors: 0 });
    fleetSocketsRef.current = [];

    toast.info(`${fleetCount} виртуал станцыг ачаалж байна...`);

    for (let i = 1; i <= fleetCount; i++) {
      const stationId = `FLEET-SIM-${String(i).padStart(3, '0')}`;
      const endpoint = `${wsUrl.replace(/\/$/, '')}/${encodeURIComponent(stationId)}`;
      try {
        const ws = new WebSocket(endpoint, ['ocpp1.6']);
        fleetSocketsRef.current.push(ws);

        ws.onopen = () => {
          setFleetStats((prev) => ({ ...prev, totalConnected: prev.totalConnected + 1, totalFrames: prev.totalFrames + 1 }));

          // Boot
          const id = Math.random().toString(36).substring(2, 9);
          ws.send(
            JSON.stringify([
              2,
              id,
              'BootNotification',
              {
                chargePointVendor: 'EPlug-Fleet',
                chargePointModel: 'FastDC',
                chargePointSerialNumber: `SN-${stationId}`,
              },
            ]),
          );

          // Status Available
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              setFleetStats((prev) => ({ ...prev, totalFrames: prev.totalFrames + 1 }));
              ws.send(
                JSON.stringify([
                  2,
                  Math.random().toString(36).substring(2, 9),
                  'StatusNotification',
                  { connectorId: 1, errorCode: 'NoError', status: 'Available', timestamp: new Date().toISOString() },
                ]),
              );
            }
          }, 300);
        };

        ws.onmessage = () => {
          setFleetStats((prev) => ({ ...prev, totalFrames: prev.totalFrames + 1 }));
        };

        ws.onerror = () => {
          setFleetStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
        };
      } catch (err) {
        setFleetStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      }
    }
  };

  const stopFleetTest = () => {
    fleetSocketsRef.current.forEach((ws) => ws.close());
    fleetSocketsRef.current = [];
    setFleetRunning(false);
    toast.info('Ачааллын тест зогслоо');
  };

  // Status Badge Helper
  const renderStatusBadge = () => {
    switch (stationStatus) {
      case 'Available':
        return <Badge tone="ok"><Dot tone="ok" /> Available (Бэлэн)</Badge>;
      case 'Preparing':
        return <Badge tone="warn"><Dot tone="warn" /> Preparing (Кабель залгагдсан)</Badge>;
      case 'Charging':
        return <Badge tone="ok"><Dot tone="ok" /> Charging (Цэнэглэж байна)</Badge>;
      case 'Finishing':
        return <Badge tone="info"><Dot tone="info" /> Finishing (Дуусч байна)</Badge>;
      case 'Faulted':
        return <Badge tone="danger"><Dot tone="danger" /> Faulted (Алдаатай)</Badge>;
      default:
        return <Badge tone="idle"><Dot tone="idle" /> Offline (Холбогдоогүй)</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Mode Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-fg)] flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-[var(--color-brand)]" />
            OCPP 1.6J Цэнэглэх Станцын Симулятор
          </h1>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            Машины VIN, зайны багтаамж, бодит GB/T DataTransfer болон ачаалал шалгах бүрэн симулятор.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          <button
            onClick={() => setActiveTab('single')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              activeTab === 'single'
                ? 'bg-[var(--color-brand)] text-[var(--color-brand-fg)] shadow-sm'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <Zap className="h-4 w-4" />
            Эхнээс нь дуустал турших
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              activeTab === 'fleet'
                ? 'bg-[var(--color-brand)] text-[var(--color-brand-fg)] shadow-sm'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <Layers className="h-4 w-4" />
            Ачаалал шалгах (Fleet Load)
          </button>
          <button
            onClick={() => setActiveTab('detections')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              activeTab === 'detections'
                ? 'bg-[var(--color-brand)] text-[var(--color-brand-fg)] shadow-sm'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            <Car className="h-4 w-4" />
            Бодит илэрсэн машинуудын лог
          </button>
        </div>
      </div>

      {activeTab === 'single' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Station & Vehicle Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Station Connection Card */}
            <Card>
              <CardHeader
                title="1. Цэнэглэх станц холбох"
                description="CSMS Central System рүү шууд WebSocket холболт үүсгэнэ"
                actions={renderStatusBadge()}
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--color-fg-muted)]">Станцын дугаар (cpId)</label>
                    <Input
                      disabled={connected}
                      value={cpId}
                      onChange={(e) => setCpId(e.target.value)}
                      placeholder="CP-SIM-001"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--color-fg-muted)]">Холбогч (Connector ID)</label>
                    <Input
                      type="number"
                      disabled={connected}
                      value={connectorId}
                      onChange={(e) => setConnectorId(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--color-fg-muted)]">WebSocket URL</label>
                  <Input
                    disabled={connected}
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    placeholder="ws://localhost:3000/ocpp"
                    className="mt-1 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {!connected ? (
                    <Button
                      variant="primary"
                      onClick={handleConnect}
                      loading={connecting}
                      className="gap-2"
                    >
                      <Wifi className="h-4 w-4" />
                      Станцыг асааж холбох (Connect & Boot)
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={handleDisconnect} className="gap-2">
                      <WifiOff className="h-4 w-4" />
                      Салгах (Disconnect)
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* 2. Vehicle Selection Card */}
            <Card>
              <CardHeader
                title="2. Цахилгаан машин сонгох (Vehicle & VIN)"
                description="GB/T 27930 кабелиар дамжих машины тодорхойлолт"
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VEHICLE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPresetId(p.id)}
                      className={cn(
                        'flex flex-col items-start p-3 rounded-xl border text-left transition',
                        selectedPresetId === p.id
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 ring-1 ring-[var(--color-brand)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]',
                      )}
                    >
                      <Car className="h-4 w-4 mb-2 text-[var(--color-brand)]" />
                      <div className="text-xs font-semibold text-[var(--color-fg)]">{p.name}</div>
                      <div className="text-[10px] text-[var(--color-fg-muted)] mt-1">{p.batteryKwh} kWh</div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs font-medium text-[var(--color-fg-muted)]">Машины VIN дугаар (17 тэмдэгт)</label>
                    <Input
                      value={customCar.vin}
                      onChange={(e) => setCustomCar({ ...customCar, vin: e.target.value.toUpperCase() })}
                      className="mt-1 font-mono uppercase tracking-wider"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--color-fg-muted)]">Зайны багтаамж (kWh)</label>
                    <Input
                      type="number"
                      value={customCar.batteryKwh}
                      onChange={(e) => setCustomCar({ ...customCar, batteryKwh: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* 3. Interactive Charging Lifecycle Card */}
            <Card className="border-[var(--color-brand)]/30">
              <CardHeader
                title="3. Цэнэглэлтийн бодит урсгал (User Journey)"
                description="Хэрэглэгчийн бодит алхмуудаар ээлж дараалан турших"
              />
              <CardBody className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Step A: Plug In */}
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-[var(--color-fg)] flex items-center gap-1.5">
                        <Plug className="h-4 w-4 text-amber-500" />
                        Алхам 1: Кабель залгах
                      </div>
                      <p className="text-[11px] text-[var(--color-fg-muted)] mt-1">
                        Preparing төлөвт шилжиж, GB/T DataTransfer-ээр машины VIN ({customCar.vin})-ийг илгээнэ.
                      </p>
                    </div>
                    <Button
                      variant={stationStatus === 'Preparing' ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={handlePlugIn}
                      disabled={!connected || stationStatus === 'Charging'}
                      className="mt-3 w-full"
                    >
                      {stationStatus === 'Preparing' ? '✓ Кабель залгагдсан' : 'Кабель залгах & Handshake'}
                    </Button>
                  </div>

                  {/* Step B: Start Charging */}
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-[var(--color-fg)] flex items-center gap-1.5">
                        <BatteryCharging className="h-4 w-4 text-emerald-500" />
                        Алхам 2: Цэнэглэлт эхлүүлэх
                      </div>
                      <p className="text-[11px] text-[var(--color-fg-muted)] mt-1">
                        Карт эсвэл Апп-аар StartTransaction явуулж, машин руу гүйдэл өгнө.
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={idTag}
                        onChange={(e) => setIdTag(e.target.value)}
                        placeholder="idTag"
                        className="h-8 text-xs font-mono"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStartCharging()}
                        disabled={!connected || stationStatus === 'Charging'}
                        className="shrink-0"
                      >
                        Эхлүүлэх
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Live Battery & Power Visualizer */}
                {stationStatus === 'Charging' || activeTxId ? (
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          Идэвхтэй цэнэглэж байна (Гүйлгээ #{activeTxId})
                        </span>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleStopCharging('Local')}>
                        <Square className="h-3.5 w-3.5 mr-1" />
                        Цэнэглэлт зогсоох (Stop)
                      </Button>
                    </div>

                    {/* Battery Bar */}
                    <div>
                      <div className="flex justify-between text-xs font-medium text-[var(--color-fg)] mb-1">
                        <span>Зайны түвшин (SoC):</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{currentSoc}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[var(--color-surface-2)] overflow-hidden border border-[var(--color-border)]">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${currentSoc}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                        <div className="text-[10px] text-[var(--color-fg-muted)]">Одоогийн чадал</div>
                        <div className="text-sm font-bold font-mono text-[var(--color-fg)]">{currentPowerKw} kW</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                        <div className="text-[10px] text-[var(--color-fg-muted)]">Нийт цэнэг</div>
                        <div className="text-sm font-bold font-mono text-[var(--color-fg)]">
                          {(meterWh / 1000).toFixed(2)} kWh
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                        <div className="text-[10px] text-[var(--color-fg-muted)]">Машин</div>
                        <div className="text-sm font-bold truncate text-[var(--color-fg)]">{customCar.name}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Fault Simulation Row */}
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <div className="text-xs font-medium text-[var(--color-fg-muted)] mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    Алдааны дохиолол шалгах (Fault Injection):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => handleInjectFault('GroundFailure')}
                      disabled={!connected}
                      className="text-xs"
                    >
                      Газардуулгын алдаа (GroundFailure)
                    </Button>
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => handleInjectFault('HighTemperature')}
                      disabled={!connected}
                      className="text-xs"
                    >
                      Хэт халалт (HighTemp)
                    </Button>
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => handleInjectFault('EmergencyStop')}
                      disabled={!connected}
                      className="text-xs"
                    >
                      Аваарын зогсолт (EmergencyStop)
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleClearFault}
                      disabled={!connected}
                      className="text-xs text-emerald-600"
                    >
                      Алдааг арилгах (Clear)
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Right Column: Live OCPP Message Inspector / Console (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="h-full flex flex-col">
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-[var(--color-brand)]" />
                    Шууд OCPP Лог (Frame Inspector)
                  </div>
                }
                actions={
                  <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="h-7 text-xs">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Цэвэрлэх
                  </Button>
                }
              />
              <CardBody className="p-0 flex-1 overflow-hidden">
                <div className="h-[640px] overflow-y-auto p-3 space-y-2 font-mono text-xs bg-[var(--color-surface-2)]/50">
                  {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--color-fg-muted)]">
                      <Terminal className="h-8 w-8 mb-2 opacity-30" />
                      <div>Одоогоор OCPP мессеж алга байна</div>
                      <div className="text-[10px] mt-1">Станцыг холбоход илгээсэн/хүлээн авсан хүрээнүүд энд гарна</div>
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          'p-2.5 rounded-lg border text-[11px] leading-relaxed transition',
                          log.direction === 'OUT'
                            ? 'bg-[var(--color-surface)] border-blue-500/30'
                            : 'bg-[var(--color-surface)] border-emerald-500/30',
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-bold',
                              log.direction === 'OUT'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                            )}
                          >
                            {log.direction === 'OUT' ? '➔ CSMS рүү (CALL)' : '← CSMS-ээс'}
                          </span>
                          {log.action ? (
                            <span className="font-semibold text-[var(--color-fg)]">{log.action}</span>
                          ) : null}
                          <span className="text-[10px] text-[var(--color-fg-muted)]">{log.time}</span>
                        </div>
                        <pre className="overflow-x-auto text-[10px] text-[var(--color-fg-muted)] p-1 rounded bg-[var(--color-surface-2)]">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : activeTab === 'fleet' ? (
        /* Fleet Load Testing Tab */
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Ачаалал ба олон станцын туршилт (Fleet Stress Testing)"
              description="Их хэмжээний виртуал станцуудыг зэрэг холбож, CSMS серверийн даац болон тогтвортой байдлыг шалгана"
            />
            <CardBody className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-[var(--color-fg-muted)]">Станцын тоо (Fleet Count)</label>
                  <div className="flex items-center gap-3 mt-1">
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={fleetCount}
                      onChange={(e) => setFleetCount(Number(e.target.value))}
                      disabled={fleetRunning}
                    />
                    <span className="text-xs text-[var(--color-fg-muted)] shrink-0">станц</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-[var(--color-fg-muted)]">Зорилтот WebSocket URL</label>
                  <Input
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    disabled={fleetRunning}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Start / Stop Fleet Controls */}
              <div className="flex gap-3">
                {!fleetRunning ? (
                  <Button variant="primary" onClick={startFleetTest} className="gap-2">
                    <Play className="h-4 w-4" />
                    {fleetCount} станцын ачааллын тест эхлүүлэх
                  </Button>
                ) : (
                  <Button variant="danger" onClick={stopFleetTest} className="gap-2">
                    <Square className="h-4 w-4" />
                    Бүх станцыг салгаж зогсоох
                  </Button>
                )}
              </div>

              {/* Live Metric Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--color-border)]">
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="text-xs text-[var(--color-fg-muted)]">Амжилттай холбогдсон</div>
                  <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {fleetStats.totalConnected} / {fleetCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="text-xs text-[var(--color-fg-muted)]">Солилцсон мессеж (Frames)</div>
                  <div className="text-2xl font-bold font-mono text-[var(--color-fg)] mt-1">
                    {fleetStats.totalFrames}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="text-xs text-[var(--color-fg-muted)]">Алдаа (Errors)</div>
                  <div className="text-2xl font-bold font-mono text-rose-500 mt-1">
                    {fleetStats.errors}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="text-xs text-[var(--color-fg-muted)]">Тестийн төлөв</div>
                  <div className="text-sm font-semibold text-[var(--color-fg)] mt-2 flex items-center gap-2">
                    {fleetRunning ? (
                      <>
                        <Dot tone="ok" /> Ажиллаж байна
                      </>
                    ) : (
                      <>
                        <Dot tone="idle" /> Зогссон
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <VehicleDetectionsTab />
      )}
    </div>
  );
}

function VehicleDetectionsTab() {
  const [search, setSearch] = React.useState('');
  const [selectedLog, setSelectedLog] = React.useState<VehicleDetectionRecord | null>(null);

  const { data, isLoading, mutate } = useSWR<{
    data: VehicleDetectionRecord[];
    total: number;
  }>(apiUrl('vehicle-detections', { limit: 50, vin: search || undefined }), fetcher, {
    refreshInterval: 5000,
  });

  const list = data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-[var(--color-brand)]" />
              Бодит станцад холбогдсон машинуудын лог (Vehicle Detection Database)
            </div>
          }
          description="Станц дээр кабель залгагдах эсвэл цэнэглэлт эхлэх бүрт машин болон VIN-ийг автоматаар өгөгдлийн санд (vehicledetections) хадгалсан түүх."
          actions={
            <Button variant="secondary" size="sm" onClick={() => mutate()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Шинэчлэх
            </Button>
          }
        />
        <CardBody className="p-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-fg-muted)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="VIN дугаараар хайх..."
                className="pl-9 text-xs font-mono"
              />
            </div>
          </div>

          <TableWrap maxHeight="28rem">
            <Table>
              <THead>
                <tr>
                  <TH>Хугацаа</TH>
                  <TH>Станц (cpId)</TH>
                  <TH>Машины VIN</TH>
                  <TH>Загвар</TH>
                  <TH>Эх сурвалж (Source)</TH>
                  <TH>Зайны багтаамж / SoC</TH>
                  <TH>Гүйлгээ ID</TH>
                  <TH>Түүхий өгөгдөл</TH>
                </tr>
              </THead>
              <TBody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-xs text-[var(--color-fg-muted)]">
                      Уншиж байна...
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-xs text-[var(--color-fg-muted)]">
                      Одоогоор машинтай холбогдсон бичлэг алга байна. Бодит станцад машин залгахад энд автоматаар бүртгэгдэнэ.
                    </td>
                  </tr>
                ) : (
                  list.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--color-surface-2)]/50 transition">
                      <td className="text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
                        {formatDateTime(item.detectedAt)}
                      </td>
                      <td className="text-xs font-semibold text-[var(--color-fg)]">
                        {item.cpId}
                      </td>
                      <td className="text-xs font-mono font-bold text-[var(--color-brand)]">
                        {item.vin || '—'}
                      </td>
                      <td className="text-xs text-[var(--color-fg)]">
                        {item.model || '—'}
                      </td>
                      <td className="text-xs">
                        <Badge tone={item.source === 'DataTransfer' ? 'ok' : 'info'}>
                          {item.source}
                          {item.protocolMessage ? ` (${item.protocolMessage})` : ''}
                        </Badge>
                      </td>
                      <td className="text-xs text-[var(--color-fg)] font-mono">
                        {item.batteryCapacity ? `${item.batteryCapacity} kWh` : ''}
                        {item.soc !== undefined && item.soc !== null ? ` (${item.soc}%)` : ''}
                        {!item.batteryCapacity && item.soc === undefined ? '—' : ''}
                      </td>
                      <td className="text-xs font-mono text-[var(--color-fg-muted)]">
                        {item.transactionId ? `#${item.transactionId}` : '—'}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(item)}
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Харах
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        </CardBody>
      </Card>

      {/* Raw Payload Modal / Inspector */}
      {selectedLog ? (
        <Card className="border-[var(--color-brand)]/40">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold">Станц: {selectedLog.cpId}</span>
                <span className="text-xs text-[var(--color-fg-muted)]">· {formatDateTime(selectedLog.detectedAt)}</span>
              </div>
            }
            actions={
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                Хаах
              </Button>
            }
          />
          <CardBody className="p-4">
            <div className="text-xs font-medium text-[var(--color-fg)] mb-2">Станцаас илгээсэн түүхий өгөгдөл (Raw Payload):</div>
            <pre className="p-3 rounded-lg bg-[var(--color-surface-2)] text-[11px] font-mono overflow-x-auto text-[var(--color-fg)]">
              {JSON.stringify(selectedLog.rawPayload ?? selectedLog, null, 2)}
            </pre>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
