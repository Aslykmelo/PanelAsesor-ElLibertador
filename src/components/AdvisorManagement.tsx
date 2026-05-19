import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Advisor } from '../types';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Users as UsersIcon, 
  Search, 
  Mail, 
  Briefcase, 
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Filter,
  X,
  User as UserIcon,
  Shield,
  Loader2,
  Database,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ADVISORS } from '@/constants'; 

export function AdvisorManagement() {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState<Advisor | null>(null);
  const [newAdvisor, setNewAdvisor] = useState({
    name: '',
    email: '',
    supervisor: '',
    supervisorEmail: '',
    cartera: '',
    role: 'advisor',
    active: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'asesores'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Advisor[];
      setAdvisors(data);
      setLoading(false);
    }, (error) => {
      console.error("Advisors management sync error:", {
        code: error.code,
        message: error.message,
        path: 'asesores'
      });
      toast.error("Error de permisos al sincronizar el directorio de asesores");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredAdvisors = useMemo(() => {
    // Deduplicar primero por email
    const uniqueByEmail = advisors.reduce((acc: Advisor[], current) => {
      const email = (current.email || '').toLowerCase();
      if (!acc.find(item => (item.email || '').toLowerCase() === email)) {
        acc.push(current);
      }
      return acc;
    }, []);

    return uniqueByEmail.filter(adv => 
      (adv.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (adv.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (adv.cartera || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (adv.supervisor || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [advisors, searchTerm]);

  const handleAddAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdvisor.name || !newAdvisor.email || !newAdvisor.supervisor || !newAdvisor.cartera) {
      toast.error("Por favor completa todos los campos obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'asesores'), {
        ...newAdvisor,
        email: newAdvisor.email.toLowerCase(),
        supervisorEmail: newAdvisor.supervisorEmail.toLowerCase(),
        createdAt: serverTimestamp(),
        active: true
      });
      toast.success("Asesor agregado exitosamente");
      setIsAddDialogOpen(false);
      setNewAdvisor({
        name: '',
        email: '',
        supervisor: '',
        supervisorEmail: '',
        cartera: '',
        role: 'advisor',
        active: true
      });
    } catch (error) {
      console.error("Error adding advisor:", error);
      toast.error("Error al agregar el asesor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdvisor || !editingAdvisor.name || !editingAdvisor.email || !editingAdvisor.supervisor || !editingAdvisor.cartera) {
      toast.error("Por favor completa todos los campos obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'asesores', editingAdvisor.id!), {
        name: editingAdvisor.name,
        email: editingAdvisor.email.toLowerCase(),
        supervisor: editingAdvisor.supervisor,
        supervisorEmail: editingAdvisor.supervisorEmail?.toLowerCase() || '',
        cartera: editingAdvisor.cartera,
        role: editingAdvisor.role,
        active: editingAdvisor.active
      });
      toast.success("Asesor actualizado exitosamente");
      setIsEditDialogOpen(false);
      setEditingAdvisor(null);
    } catch (error) {
      console.error("Error updating advisor:", error);
      toast.error("Error al actualizar el asesor");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (adv: Advisor) => {
    setEditingAdvisor({ ...adv });
    setIsEditDialogOpen(true);
  };

  const toggleAdvisorStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'asesores', id), {
        active: !currentStatus
      });
      toast.success(`Asesor ${!currentStatus ? 'activado' : 'desactivado'}`);
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Error al cambiar el estado");
    }
  };

  const handleDeleteAdvisor = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este asesor?")) return;
    try {
      await deleteDoc(doc(db, 'asesores', id));
      toast.success("Asesor eliminado");
    } catch (error) {
      console.error("Error deleting advisor:", error);
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-secondary tracking-tight">Gestión de Asesores</h2>
          <p className="text-muted-foreground font-medium">Administra los asesores receptores del sistema</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={
              <Button className="rounded-2xl h-12 px-8 font-black shadow-xl shadow-primary/20 gap-2">
                <Plus className="w-5 h-5" />
                Agregar Asesor
              </Button>
            } />
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-lg">
              <div className="bg-primary p-8 text-white">
                <DialogTitle className="text-2xl font-black tracking-tight">Nuevo Asesor</DialogTitle>
                <DialogDescription className="text-white/70 font-medium mt-1">
                  Ingresa los datos para registrar un nuevo asesor en el sistema.
                </DialogDescription>
              </div>
              <form onSubmit={handleAddAdvisor}>
                <div className="p-8 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Completo *</Label>
                    <Input 
                      placeholder="Ej: Sergio Camilo Perez" 
                      className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                      value={newAdvisor.name}
                      onChange={e => setNewAdvisor({...newAdvisor, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Corporativo *</Label>
                    <Input 
                      type="email"
                      placeholder="ejemplo@segurosbolivar.com" 
                      className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                      value={newAdvisor.email}
                      onChange={e => setNewAdvisor({...newAdvisor, email: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Supervisor *</Label>
                      <Input 
                        placeholder="Nombre Supervisor" 
                        className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                        value={newAdvisor.supervisor}
                        onChange={e => setNewAdvisor({...newAdvisor, supervisor: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cartera *</Label>
                      <Input 
                        placeholder="Ej: Jurídico" 
                        className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                        value={newAdvisor.cartera}
                        onChange={e => setNewAdvisor({...newAdvisor, cartera: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Supervisor *</Label>
                    <Input 
                      type="email"
                      placeholder="supervisor@segurosbolivar.com" 
                      className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                      value={newAdvisor.supervisorEmail}
                      onChange={e => setNewAdvisor({...newAdvisor, supervisorEmail: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rol en el Sistema</Label>
                    <Select 
                      value={newAdvisor.role} 
                      onValueChange={val => setNewAdvisor({...newAdvisor, role: val})}
                    >
                      <SelectTrigger className="h-12 bg-muted/50 border-none rounded-2xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="advisor" className="font-bold">Asesor</SelectItem>
                        <SelectItem value="supervisor" className="font-bold">Supervisor</SelectItem>
                        <SelectItem value="admin" className="font-bold">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="p-8 bg-muted/20 border-t border-border/50">
                   <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                   <Button type="submit" disabled={submitting} className="rounded-xl font-black bg-primary px-8">
                     {submitting ? <Loader2 className="animate-spin" /> : 'Registrar Asesor'}
                   </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* EDIT ADVISOR DIALOG */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-lg">
              <div className="bg-secondary p-8 text-white">
                <DialogTitle className="text-2xl font-black tracking-tight">Editar Asesor</DialogTitle>
                <DialogDescription className="text-white/70 font-medium mt-1">
                  Modifica los datos del asesor seleccionado.
                </DialogDescription>
              </div>
              {editingAdvisor && (
                <form onSubmit={handleEditAdvisor}>
                  <div className="p-8 space-y-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Completo *</Label>
                      <Input 
                        placeholder="Ej: Sergio Camilo Perez" 
                        className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                        value={editingAdvisor.name}
                        onChange={e => setEditingAdvisor({...editingAdvisor, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Corporativo *</Label>
                      <Input 
                        type="email"
                        placeholder="ejemplo@segurosbolivar.com" 
                        className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                        value={editingAdvisor.email}
                        onChange={e => setEditingAdvisor({...editingAdvisor, email: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Supervisor *</Label>
                        <Input 
                          placeholder="Nombre Supervisor" 
                          className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                          value={editingAdvisor.supervisor}
                          onChange={e => setEditingAdvisor({...editingAdvisor, supervisor: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cartera *</Label>
                        <Input 
                          placeholder="Ej: Jurídico" 
                          className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                          value={editingAdvisor.cartera}
                          onChange={e => setEditingAdvisor({...editingAdvisor, cartera: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Supervisor *</Label>
                      <Input 
                        type="email"
                        placeholder="supervisor@segurosbolivar.com" 
                        className="h-12 bg-muted/50 border-none rounded-2xl font-bold"
                        value={editingAdvisor.supervisorEmail}
                        onChange={e => setEditingAdvisor({...editingAdvisor, supervisorEmail: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rol en el Sistema</Label>
                      <Select 
                        value={editingAdvisor.role} 
                        onValueChange={val => setEditingAdvisor({...editingAdvisor, role: val})}
                      >
                        <SelectTrigger className="h-12 bg-muted/50 border-none rounded-2xl font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="advisor" className="font-bold">Asesor</SelectItem>
                          <SelectItem value="supervisor" className="font-bold">Supervisor</SelectItem>
                          <SelectItem value="admin" className="font-bold">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="p-8 bg-muted/20 border-t border-border/50">
                    <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                    <Button type="submit" disabled={submitting} className="rounded-xl font-black bg-secondary text-white px-8">
                      {submitting ? <Loader2 className="animate-spin" /> : 'Guardar Cambios'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <Input 
          placeholder="Buscar asesores por nombre, correo, cartera o supervisor..." 
          className="pl-14 h-16 bg-card border-none rounded-[2rem] shadow-sm text-lg font-medium focus-visible:ring-2 focus-visible:ring-primary/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ADVISORS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredAdvisors.map((adv, i) => (
            <motion.div
              key={adv.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="rounded-[2.5rem] border-none shadow-md hover:shadow-xl transition-all duration-500 overflow-hidden group bg-card">
                <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center font-black text-2xl text-secondary shadow-inner">
                      {adv.name.charAt(0)}
                    </div>
                    <div className="flex gap-2">
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(adv)}
                        className="rounded-xl h-10 w-10 text-primary hover:bg-primary/5"
                        title="Editar"
                       >
                         <Pencil className="w-5 h-5" />
                       </Button>
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleAdvisorStatus(adv.id!, adv.active)}
                        className={cn("rounded-xl h-10 w-10", adv.active ? "text-green-500 hover:bg-green-50" : "text-muted-foreground hover:bg-muted")}
                        title={adv.active ? "Desactivar" : "Activar"}
                       >
                         {adv.active ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                       </Button>
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteAdvisor(adv.id!)}
                        className="rounded-xl h-10 w-10 text-red-400 hover:bg-red-50"
                        title="Eliminar"
                       >
                         <Trash2 className="w-5 h-5" />
                       </Button>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-secondary tracking-tight truncate">{adv.name}</h3>
                      {!adv.active && <Badge variant="secondary" className="bg-red-100 text-red-600 border-none font-black text-[9px] px-2 h-5">INACTIVO</Badge>}
                    </div>
                    <p className="text-xs font-bold text-primary/70 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {adv.email}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border/50">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1 mb-1">
                        <Briefcase className="w-3 h-3" /> Cartera
                      </p>
                      <p className="text-xs font-bold text-secondary truncate">{adv.cartera}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1 mb-1">
                        <UserIcon className="w-3 h-3" /> Supervisor
                      </p>
                      <p className="text-xs font-bold text-secondary truncate">{adv.supervisor}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!loading && filteredAdvisors.length === 0 && (
        <div className="text-center py-20 bg-card/50 rounded-[3rem] border border-dashed border-border transition-all">
          <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <UsersIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <p className="text-xl font-bold text-muted-foreground">No se encontraron asesores registrados</p>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Usa el botón de arriba para agregar uno nuevo.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-bold tracking-widest text-[10px] uppercase">Cargando Directorio...</p>
        </div>
      )}
    </div>
  );
}
