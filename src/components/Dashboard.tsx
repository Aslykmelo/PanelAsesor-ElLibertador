import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  UserCheck,
  Award,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, startOfDay, eachDayOfInterval, subDays, isSameDay } from 'date-fns';
import { Transfer } from '@/types';

interface DashboardProps {
  transfers: Transfer[];
  onNewTransfer?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ transfers, onNewTransfer }) => {
  // Calculations
  const totalInteractions = transfers.length;
  const totalMessages = transfers.filter(t => t.managementType === 'Mensaje (Transferencia de llamada)').length;
  const totalGifts = transfers.filter(t => t.managementType === 'Regalo (Generación de link de pago)').length;
  const messagePercentage = totalInteractions > 0 ? Math.round((totalMessages / totalInteractions) * 100) : 0;
  const giftPercentage = totalInteractions > 0 ? Math.round((totalGifts / totalInteractions) * 100) : 0;
  const totalValue = transfers.reduce((acc, t) => acc + t.paymentLinkValue, 0);

  // Top Performers
  const getTopPerformer = (type: 'sender' | 'receiver' | 'value') => {
    const counts: Record<string, number> = {};
    transfers.forEach(t => {
      if (type === 'sender') {
        counts[t.fromAdvisorName] = (counts[t.fromAdvisorName] || 0) + 1;
      } else if (type === 'receiver') {
        counts[t.toAdvisorName] = (counts[t.toAdvisorName] || 0) + 1;
      } else if (type === 'value' && t.managementType === 'Regalo (Generación de link de pago)') {
        counts[t.fromAdvisorName] = (counts[t.fromAdvisorName] || 0) + t.paymentLinkValue;
      }
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] || ['N/A', 0];
  };

  const topValueSender = getTopPerformer('value');
  const topSender = getTopPerformer('sender');
  const topReceiver = getTopPerformer('receiver');

  // Chart Data: Pie
  const pieData = [
    { name: 'Mensajes', value: totalMessages, color: '#a1161b' },
    { name: 'Regalos', value: totalGifts, color: '#153157' },
  ];

  // Chart Data: Top Senders (Bar)
  const senderCounts: Record<string, number> = {};
  transfers.forEach(t => {
    senderCounts[t.fromAdvisorName] = (senderCounts[t.fromAdvisorName] || 0) + 1;
  });
  const senderData = Object.entries(senderCounts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Chart Data: Top Receivers (Bar)
  const receiverCounts: Record<string, number> = {};
  transfers.forEach(t => {
    receiverCounts[t.toAdvisorName] = (receiverCounts[t.toAdvisorName] || 0) + 1;
  });
  const receiverData = Object.entries(receiverCounts)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Chart Data: Evolution (Line)
  const last7Days = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date(),
  });

  const evolutionData = last7Days.map(day => {
    const dayTransfers = transfers.filter(t => isSameDay(new Date(t.createdAt), day));
    return {
      date: format(day, 'dd/MM'),
      total: dayTransfers.length,
      mensajes: dayTransfers.filter(t => t.managementType === 'Mensaje (Transferencia de llamada)').length,
      regalos: dayTransfers.filter(t => t.managementType === 'Regalo (Generación de link de pago)').length,
    };
  });

  const stats = [
    { title: 'Total Interacciones', value: totalInteractions, icon: <PhoneCall className="w-4 h-4" />, color: 'border-l-primary' },
    { title: 'Total Mensajes', value: totalMessages, icon: <Clock className="w-4 h-4" />, color: 'border-l-blue-500' },
    { title: 'Total Regalos', value: totalGifts, icon: <CheckCircle2 className="w-4 h-4" />, color: 'border-l-green-500' },
    { title: 'Valor Generado', value: `$${totalValue.toLocaleString()}`, icon: <DollarSign className="w-4 h-4" />, color: 'border-l-yellow-500' },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-secondary">Dashboard Ejecutivo</h2>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest leading-relaxed">Monitoreo en tiempo real de transferencias y links de pago.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl border-secondary text-secondary font-bold hover:bg-secondary/5">Exportar Datos</Button>
          <Button className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20" onClick={onNewTransfer}>Nuevo Registro</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className={`border-none bg-card shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] overflow-hidden`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-secondary uppercase tracking-wider">{stat.title}</CardTitle>
              <div className="p-2 bg-secondary/5 rounded-full text-secondary">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-secondary tracking-tighter">{stat.value}</div>
              <div className="flex items-center mt-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                <span>+4% vs periodo anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-lg border-none bg-card rounded-[2rem]">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-xs font-black text-secondary flex items-center gap-2 uppercase tracking-widest">
              <Award className="w-5 h-5 text-yellow-500" />
              TOP GENERADOR VALOR
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-secondary uppercase tracking-tight truncate max-w-[150px]">{topValueSender[0]}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Links de pago</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-primary">${Number(topValueSender[1]).toLocaleString()}</p>
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-none font-black text-[10px] uppercase">🥇 Oro</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-none bg-card rounded-[2rem]">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-xs font-black text-secondary flex items-center gap-2 uppercase tracking-widest">
              <UserCheck className="w-5 h-5 text-blue-500" />
              TOP TRANSFERENCIAS
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-secondary uppercase tracking-tight truncate max-w-[150px]">{topSender[0]}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Asesor que más envía</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-secondary">{topSender[1]}</p>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 border-none font-black text-[10px] uppercase">🥈 Plata</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-none bg-card rounded-[2rem]">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-xs font-black text-secondary flex items-center gap-2 uppercase tracking-widest">
              <TrendingUp className="w-5 h-5 text-green-500" />
              TOP RECEPTOR
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-secondary uppercase tracking-tight truncate max-w-[150px]">{topReceiver[0]}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Asesor que más recibe</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-secondary">{topReceiver[1]}</p>
                <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-none font-black text-[10px] uppercase">🥉 Bronce</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-lg border-none bg-card rounded-[2rem]">
          <CardHeader className="border-b border-border/50 px-8 py-6">
            <CardTitle className="text-lg font-black text-secondary uppercase tracking-widest">Evolución de Registros</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--muted-foreground)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--muted-foreground)' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--card)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}/>
                  <Line type="monotone" dataKey="mensajes" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--card)' }} activeDot={{ r: 6 }} name="Mensajes" />
                  <Line type="monotone" dataKey="regalos" stroke="var(--secondary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--secondary)', strokeWidth: 2, stroke: 'var(--card)' }} activeDot={{ r: 6 }} name="Regalos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-lg border-none bg-card rounded-[2rem]">
          <CardHeader className="border-b border-border/50 px-8 py-6">
            <CardTitle className="text-lg font-black text-secondary uppercase tracking-widest">Distribución de Gestión</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'var(--secondary)'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary/10 rounded-2xl text-center border border-primary/10">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Mensajes</p>
                <p className="text-2xl font-black text-secondary">{messagePercentage}%</p>
              </div>
              <div className="p-4 bg-secondary/10 rounded-2xl text-center border border-secondary/10">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Regalos</p>
                <p className="text-2xl font-black text-secondary">{giftPercentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg border-none bg-card rounded-[2rem]">
          <CardHeader className="border-b border-border/50 px-8 py-6">
            <CardTitle className="text-lg font-black text-secondary uppercase tracking-widest">Asesores que más Envían</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={senderData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--foreground)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--muted)/10' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--card)' }}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[0, 8, 8, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-none bg-card rounded-[2rem]">
          <CardHeader className="border-b border-border/50 px-8 py-6">
            <CardTitle className="text-lg font-black text-secondary uppercase tracking-widest">Asesores que más Reciben</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={receiverData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--foreground)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--muted)/10' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--card)' }}
                  />
                  <Bar dataKey="total" fill="var(--secondary)" radius={[0, 8, 8, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
