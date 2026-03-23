import React, { useState, useEffect, Component, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from './supabase';
import { User, EscortProfile, UserType, Report, UserStatus, VerificationStatus, BodyType, ReportStatus, Message, Price } from './types';
import { Search, User as UserIcon, MessageSquare, Heart, Shield, LogOut, Menu, X, Star, CheckCircle, ShieldAlert, Instagram, Facebook, Phone, Calendar, MapPin, Ruler, Weight, Eye, Send, Image as ImageIcon, Camera, Plus, Edit2, Trash2, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  UPLOAD = 'upload'
}

interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  table: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
  }
}

function handleSupabaseError(error: any, operationType: OperationType, table: string | null) {
  const errInfo: SupabaseErrorInfo = {
    error: error?.message || String(error),
    authInfo: {
      userId: undefined, // Will be filled if possible
      email: undefined
    },
    operationType,
    table
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  // We can't easily get current user here without async, but it's logged in the console if needed
}

class ErrorBoundary extends Component<any, any> {
  state: any;
  props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let message = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error.includes('insufficient permissions')) {
          message = "Erro de permissão: Você não tem autorização para realizar esta ação.";
        }
      } catch (e) {
        message = error?.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-main p-4">
          <div className="card p-8 max-w-md w-full text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-alert mx-auto" />
            <h2 className="text-xl font-bold">Ops! Algo correu mal</h2>
            <p className="text-text-sub text-sm">{message}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="btn-primary w-full py-2"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

const Navbar = ({ user, onLogin, onLogout }: { user: User | null, onLogin: () => void, onLogout: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    const fetchUnread = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      if (!error && count !== null) setUnreadCount(count);
    };

    fetchUnread();
    
    // Realtime subscription for unread messages
    const channel = supabase
      .channel('unread_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const navLinks = [
    { name: 'Início', path: '/', icon: Search },
    { name: 'Favoritos', path: '/favorites', icon: Heart, hide: !user || user.type !== 'client' },
    { name: 'Mensagens', path: '/messages', icon: MessageSquare, hide: !user, badge: true },
    { name: 'Verificação', path: '/verification', icon: Shield, hide: !user || user.type !== 'escort' },
    { name: 'Admin', path: '/admin', icon: Shield, hide: !user || user.type !== 'admin' },
  ];

  return (
    <nav className="bg-nav-bg text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-primary font-bold text-xl tracking-tight">MeuHomem</span>
          </Link>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.filter(link => !link.hide).map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "nav-link flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium relative",
                    location.pathname === link.path && "active text-primary"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  <span>{link.name}</span>
                  {link.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border border-nav-bg"></span>
                  )}
                </Link>
              ))}
              {user ? (
                <div className="flex items-center space-x-4 ml-4">
                  <Link to="/profile" className="flex items-center space-x-2 text-sm font-medium hover:text-primary transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                      <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                    <span>{user.name}</span>
                  </Link>
                  <button onClick={onLogout} className="text-inactive hover:text-alert transition-colors">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button onClick={onLogin} className="btn-primary text-sm">Entrar</button>
              )}
            </div>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-inactive hover:text-white">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-nav-bg border-t border-white/5"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.filter(link => !link.hide).map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium",
                    location.pathname === link.path ? "text-primary bg-white/5" : "text-inactive"
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.name}</span>
                </Link>
              ))}
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center space-x-2 px-3 py-2 text-inactive font-medium">
                    <UserIcon className="w-5 h-5" />
                    <span>Meu Perfil</span>
                  </Link>
                  <button onClick={() => { onLogout(); setIsOpen(false); }} className="w-full text-left flex items-center space-x-2 px-3 py-2 text-alert font-medium">
                    <LogOut className="w-5 h-5" />
                    <span>Sair</span>
                  </button>
                </>
              ) : (
                <button onClick={() => { onLogin(); setIsOpen(false); }} className="w-full btn-primary mt-2">Entrar</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const HomePage = () => {
  const [escorts, setEscorts] = useState<EscortProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  const cities = ['Luanda', 'Benguela', 'Lubango', 'Huambo', 'Lobito', 'Soyo'];

  useEffect(() => {
    const fetchEscorts = async () => {
      const { data, error } = await supabase
        .from('escort_profiles')
        .select('*')
        .eq('verified', 'verified')
        .limit(20);

      if (error) {
        handleSupabaseError(error, OperationType.GET, 'escort_profiles');
      } else {
        // Map snake_case to camelCase if needed, but let's assume types match or we map them
        const mappedData = data.map(item => ({
          id: item.id,
          userId: item.user_id,
          artisticName: item.artistic_name,
          age: item.age,
          city: item.city,
          verified: item.verified,
          rating: item.rating,
          views: item.views,
          mainPhotoUrl: item.main_photo_url,
          bodyType: item.body_type
        } as EscortProfile));
        setEscorts(mappedData);
      }
      setLoading(false);
    };

    fetchEscorts();

    const channel = supabase
      .channel('escort_profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escort_profiles' }, () => {
        fetchEscorts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredEscorts = escorts.filter(e => 
    (e.artisticName.toLowerCase().includes(search.toLowerCase()) || e.city.toLowerCase().includes(search.toLowerCase())) &&
    (city === '' || e.city === city)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 space-y-4">
        <h1 className="text-3xl font-bold text-text-main">Encontre a sua companhia ideal</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-inactive w-5 h-5" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou cidade..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-black/5 bg-white shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-3 rounded-xl border border-black/5 bg-white shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-w-[200px]"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">Todas as cidades</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEscorts.map((escort) => (
            <Link key={escort.id} to={`/escort/${escort.id}`} className="card group hover:shadow-md transition-all">
              <div className="aspect-[3/4] bg-gray-200 relative overflow-hidden">
                <img
                  src={escort.mainPhotoUrl || `https://picsum.photos/seed/${escort.id}/600/800`}
                  alt={escort.artisticName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 right-3">
                  {escort.verified === 'verified' && (
                    <div className="bg-verified text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center space-x-1 shadow-sm">
                      <CheckCircle className="w-3 h-3" />
                      <span>VERIFICADO</span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                  <h3 className="text-white font-bold text-lg">{escort.artisticName}</h3>
                  <p className="text-white/80 text-sm">{escort.city} • {escort.age} anos</p>
                </div>
              </div>
              <div className="p-4 flex justify-between items-center">
                <div className="flex items-center space-x-1 text-primary">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-bold">{escort.rating.toFixed(1)}</span>
                </div>
                <span className="text-text-sub text-xs uppercase tracking-wider font-semibold">{escort.bodyType}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const ServicesSection = ({ escortId, isOwner }: { escortId: string, isOwner: boolean }) => {
  const [services, setServices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Price | null>(null);
  const [formData, setFormData] = useState({ service: '', value: '', description: '' });

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('prices')
      .select('*')
      .eq('escort_id', escortId);
    
    if (error) {
      handleSupabaseError(error, OperationType.GET, 'prices');
    } else {
      setServices(data.map(item => ({
        id: item.id,
        escortId: item.escort_id,
        service: item.service,
        value: item.value,
        description: item.description
      } as Price)));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServices();
    
    const channel = supabase
      .channel(`services_${escortId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'prices',
        filter: `escort_id=eq.${escortId}`
      }, () => {
        fetchServices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [escortId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        const { error } = await supabase
          .from('prices')
          .update({
            service: formData.service,
            value: formData.value,
            description: formData.description
          })
          .eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('prices')
          .insert({
            escort_id: escortId,
            service: formData.service,
            value: formData.value,
            description: formData.description
          });
        if (error) throw error;
      }
      setIsModalOpen(false);
      setEditingService(null);
      setFormData({ service: '', value: '', description: '' });
    } catch (error) {
      handleSupabaseError(error, editingService ? OperationType.UPDATE : OperationType.CREATE, 'prices');
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    try {
      const { error } = await supabase
        .from('prices')
        .delete()
        .eq('id', serviceId);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, 'prices');
    }
  };

  const openEdit = (service: Price) => {
    setEditingService(service);
    setFormData({ service: service.service, value: service.value, description: service.description || '' });
    setIsModalOpen(true);
  };

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-xl"></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase tracking-wider text-inactive">Serviços e Preços</h3>
        {isOwner && (
          <button 
            onClick={() => { setEditingService(null); setFormData({ service: '', value: '', description: '' }); setIsModalOpen(true); }}
            className="text-primary hover:bg-primary/5 p-1 rounded-full transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {services.length === 0 ? (
          <p className="text-text-sub text-sm italic">Nenhum serviço listado.</p>
        ) : (
          services.map((s) => (
            <div key={s.id} className="flex justify-between items-start p-3 rounded-xl border border-black/5 bg-white/50 group">
              <div className="space-y-1">
                <div className="font-bold text-text-main">{s.service}</div>
                {s.description && <div className="text-xs text-text-sub">{s.description}</div>}
              </div>
              <div className="flex items-center space-x-3">
                <div className="font-bold text-primary">{s.value}</div>
                {isOwner && (
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(s)} className="p-1 text-inactive hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1 text-inactive hover:text-alert"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 w-full max-w-md space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingService ? 'Editar Serviço' : 'Adicionar Serviço'}</h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Nome do Serviço</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.service}
                    onChange={e => setFormData({...formData, service: e.target.value})}
                    placeholder="Ex: 1 Hora de Encontro"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Valor</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.value}
                    onChange={e => setFormData({...formData, value: e.target.value})}
                    placeholder="Ex: 50.000 Kz"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Descrição (Opcional)</label>
                  <textarea 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20 h-24 resize-none"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detalhes sobre o serviço..."
                  />
                </div>
                <button type="submit" className="w-full btn-primary py-3">
                  {editingService ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EscortProfilePage = ({ user }: { user: User | null }) => {
  const { id } = useParams();
  const [escort, setEscort] = useState<EscortProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editFormData, setEditFormData] = useState({
    artisticName: '',
    age: 18,
    city: 'Luanda',
    bio: '',
    height: 0,
    weight: 0,
    bodyType: 'atlético' as BodyType,
    mainPhotoUrl: '',
    instagram: '',
    facebook: ''
  });

  const fetchProfile = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('escort_profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      handleSupabaseError(error, OperationType.GET, 'escort_profiles');
    } else if (data) {
      const mappedData: EscortProfile = {
        id: data.id,
        userId: data.user_id,
        artisticName: data.artistic_name,
        age: data.age,
        city: data.city,
        verified: data.verified,
        rating: data.rating,
        views: data.views,
        mainPhotoUrl: data.main_photo_url,
        bodyType: data.body_type,
        bio: data.bio,
        height: data.height,
        weight: data.weight,
        socialLinks: data.social_links || {}
      };
      setEscort(mappedData);
      setEditFormData({
        artisticName: mappedData.artisticName,
        age: mappedData.age,
        city: mappedData.city,
        bio: mappedData.bio || '',
        height: mappedData.height || 0,
        weight: mappedData.weight || 0,
        bodyType: mappedData.bodyType || 'atlético',
        mainPhotoUrl: mappedData.mainPhotoUrl || '',
        instagram: mappedData.socialLinks?.instagram || '',
        facebook: mappedData.socialLinks?.facebook || ''
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
    
    const channel = supabase
      .channel(`profile_${id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'escort_profiles',
        filter: `id=eq.${id}`
      }, () => {
        fetchProfile();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escort) return;
    try {
      const { error } = await supabase
        .from('escort_profiles')
        .update({
          artistic_name: editFormData.artisticName,
          age: editFormData.age,
          city: editFormData.city,
          bio: editFormData.bio,
          height: editFormData.height,
          weight: editFormData.weight,
          body_type: editFormData.bodyType,
          main_photo_url: editFormData.mainPhotoUrl,
          social_links: {
            instagram: editFormData.instagram,
            facebook: editFormData.facebook
          }
        })
        .eq('id', escort.id);
      
      if (error) throw error;
      setIsEditModalOpen(false);
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'escort_profiles');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !escort) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${escort.id}-${Math.random()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      setEditFormData(prev => ({ ...prev, mainPhotoUrl: publicUrl }));
      
      // Also update immediately if in modal
      if (!isEditModalOpen) {
         await supabase
          .from('escort_profiles')
          .update({ main_photo_url: publicUrl })
          .eq('id', escort.id);
      }
    } catch (error) {
      handleSupabaseError(error, OperationType.UPLOAD, 'storage/photos');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (!escort) return <div className="text-center py-20 text-text-sub">Perfil não encontrado.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Photos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card aspect-[3/4] relative group overflow-hidden">
            <img
              src={escort.mainPhotoUrl || `https://picsum.photos/seed/${escort.id}/1200/1600`}
              alt={escort.artisticName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {user?.id === escort.userId && (
              <label className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg cursor-pointer hover:bg-white transition-all transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
                {uploadingPhoto ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                ) : (
                  <Camera className="w-5 h-5 text-primary" />
                )}
              </label>
            )}
            {escort.verified === 'verified' && (
              <div className="absolute top-4 right-4 bg-verified text-white px-3 py-1.5 rounded-full flex items-center space-x-2 shadow-lg font-bold text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>VERIFICADO</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card aspect-square">
                <img
                  src={`https://picsum.photos/seed/${escort.id}-${i}/400/400`}
                  alt={`${escort.artisticName} ${i}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-text-main">{escort.artisticName}</h1>
                <p className="text-text-sub flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{escort.city}</span>
                </p>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className="flex items-center space-x-1 text-primary bg-primary/10 px-3 py-1 rounded-full">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-bold text-lg">{escort.rating.toFixed(1)}</span>
                </div>
                {user?.id === escort.id && (
                  <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs font-bold text-primary hover:underline flex items-center space-x-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Editar Perfil</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-black/5">
              <div className="flex items-center space-x-2 text-sm">
                <Calendar className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Idade:</span>
                <span className="font-semibold">{escort.age} anos</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Ruler className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Altura:</span>
                <span className="font-semibold">{escort.height || '--'} m</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Weight className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Peso:</span>
                <span className="font-semibold">{escort.weight || '--'} kg</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <UserIcon className="w-4 h-4 text-inactive" />
                <span className="text-text-sub">Físico:</span>
                <span className="font-semibold capitalize">{escort.bodyType}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm uppercase tracking-wider text-inactive">Sobre mim</h3>
              <p className="text-text-main leading-relaxed">{escort.bio || 'Sem biografia disponível.'}</p>
            </div>

            <ServicesSection escortId={escort.id} isOwner={user?.id === escort.id} />

            <div className="space-y-3 pt-4">
              <Link to={`/chat/${escort.id}`} className="w-full btn-primary py-4 flex items-center justify-center space-x-2 text-lg">
                <MessageSquare className="w-5 h-5" />
                <span>Enviar Mensagem</span>
              </Link>
              <div className="flex gap-2">
                <button className="flex-1 btn-secondary py-3 flex items-center justify-center space-x-2">
                  <Heart className="w-5 h-5" />
                  <span>Favorito</span>
                </button>
                <button className="px-4 py-3 rounded-lg border border-alert text-alert hover:bg-alert/5 transition-colors">
                  <ShieldAlert className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-inactive">Redes Sociais</h3>
            <div className="flex space-x-4">
              {escort.socialLinks?.instagram || escort.socialLinks?.facebook ? (
                <>
                  {escort.socialLinks?.instagram && (
                    <a href={`https://instagram.com/${escort.socialLinks.instagram}`} target="_blank" rel="noreferrer" className="flex items-center space-x-2 text-text-main hover:text-primary transition-colors">
                      <Instagram className="w-5 h-5" />
                      <span>Instagram</span>
                    </a>
                  )}
                  {escort.socialLinks?.facebook && (
                    <a href={`https://facebook.com/${escort.socialLinks.facebook}`} target="_blank" rel="noreferrer" className="flex items-center space-x-2 text-text-main hover:text-primary transition-colors">
                      <Facebook className="w-5 h-5" />
                      <span>Facebook</span>
                    </a>
                  )}
                </>
              ) : (
                <p className="text-text-sub text-sm italic">Nenhuma rede social adicionada.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Editar Perfil</h3>
                <button onClick={() => setIsEditModalOpen(false)}><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Nome Artístico</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={editFormData.artisticName}
                    onChange={e => setEditFormData({...editFormData, artisticName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Foto Principal</label>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-black/5">
                      <img 
                        src={editFormData.mainPhotoUrl || 'https://picsum.photos/seed/placeholder/100/100'} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <label className="flex-1 flex items-center justify-center px-4 py-2 border border-dashed border-primary/40 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                      <div className="flex items-center space-x-2 text-primary font-bold">
                        {uploadingPhoto ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{uploadingPhoto ? 'Enviando...' : 'Alterar Foto'}</span>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Idade</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={editFormData.age}
                    onChange={e => setEditFormData({...editFormData, age: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Cidade</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={editFormData.city}
                    onChange={e => setEditFormData({...editFormData, city: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Altura (m)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={editFormData.height}
                    onChange={e => setEditFormData({...editFormData, height: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Peso (kg)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={editFormData.weight}
                    onChange={e => setEditFormData({...editFormData, weight: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Tipo Físico</label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                    value={editFormData.bodyType}
                    onChange={e => setEditFormData({...editFormData, bodyType: e.target.value as BodyType})}
                  >
                    <option value="magro">Magro</option>
                    <option value="atlético">Atlético</option>
                    <option value="forte">Forte</option>
                    <option value="musculoso">Musculoso</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Biografia</label>
                  <textarea 
                    className="w-full px-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20 h-24 resize-none"
                    value={editFormData.bio}
                    onChange={e => setEditFormData({...editFormData, bio: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Instagram (usuário)</label>
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inactive" />
                    <input 
                      type="text" 
                      placeholder="seu.perfil"
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                      value={editFormData.instagram}
                      onChange={e => setEditFormData({...editFormData, instagram: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-inactive">Facebook (usuário/slug)</label>
                  <div className="relative">
                    <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inactive" />
                    <input 
                      type="text" 
                      placeholder="seu.perfil"
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-black/5 outline-none focus:ring-2 focus:ring-primary/20"
                      value={editFormData.facebook}
                      onChange={e => setEditFormData({...editFormData, facebook: e.target.value})}
                    />
                  </div>
                </div>
                <div className="md:col-span-2 pt-4">
                  <button type="submit" className="w-full btn-primary py-3">
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RoleSelection = ({ onSelect }: { onSelect: (type: UserType) => void }) => {
  return (
    <div className="max-w-md mx-auto mt-20 p-8 card text-center space-y-6">
      <h2 className="text-2xl font-bold">Bem-vindo ao MeuHomem</h2>
      <p className="text-text-sub">Como deseja utilizar a plataforma?</p>
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => onSelect('escort')}
          className="btn-primary py-4 text-lg flex flex-col items-center"
        >
          <span className="font-bold">Sou Acompanhante</span>
          <span className="text-xs opacity-80">Quero oferecer meus serviços</span>
        </button>
        <button
          onClick={() => onSelect('client')}
          className="btn-secondary py-4 text-lg flex flex-col items-center"
        >
          <span className="font-bold">Procuro Acompanhante</span>
          <span className="text-xs opacity-80">Quero encontrar companhia</span>
        </button>
      </div>
    </div>
  );
};

const ChatPage = ({ user }: { user: User | null }) => {
  const { id: otherUserId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const fetchOtherUser = async () => {
    if (!otherUserId) return;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', otherUserId)
      .single();
    
    if (!error && data) {
      setOtherUser({
        id: data.id,
        name: data.name,
        email: data.email,
        type: data.type,
        status: data.status,
        createdAt: data.created_at,
        lastAccess: data.last_access
      } as User);
    }
  };

  const fetchMessages = async () => {
    if (!user || !otherUserId) return;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    
    if (error) {
      handleSupabaseError(error, OperationType.GET, 'messages');
    } else {
      setMessages(data.map(m => ({
        id: m.id,
        senderId: m.sender_id,
        receiverId: m.receiver_id,
        content: m.content,
        createdAt: m.created_at,
        isRead: m.is_read
      } as Message)));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  useEffect(() => {
    if (!user || !otherUserId) return;
    fetchOtherUser();
    fetchMessages();

    const channel = supabase
      .channel(`chat_${user.id}_${otherUserId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !otherUserId || !newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: otherUserId,
          content: newMessage.trim(),
          is_read: false
        });
      
      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      handleSupabaseError(error, OperationType.CREATE, 'messages');
    }
  };

  if (!user) return <div className="p-8 text-center">Inicie sessão para conversar.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 h-[calc(100vh-160px)] flex flex-col">
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-black/5 flex items-center space-x-3 bg-white">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">{otherUser?.name || 'Carregando...'}</h3>
            <p className="text-xs text-verified flex items-center"><span className="w-2 h-2 bg-verified rounded-full mr-1"></span> Online</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-main/50">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.senderId === user.id ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[70%] p-3 rounded-2xl text-sm shadow-sm",
                msg.senderId === user.id ? "bg-primary text-white rounded-tr-none" : "bg-white text-text-main rounded-tl-none"
              )}>
                {msg.content}
                <p className={cn("text-[10px] mt-1 opacity-70", msg.senderId === user.id ? "text-white" : "text-text-sub")}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-black/5 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Escreva uma mensagem..."
            className="flex-1 px-4 py-2 rounded-full bg-bg-main border-none focus:ring-2 focus:ring-primary/20 outline-none"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

const VerificationUpload = ({ user }: { user: User | null }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    }
  };

  const handleUpload = async () => {
    if (!user || !file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-verification-${Date.now()}.${fileExt}`;
      const filePath = `verifications/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('verifications')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('escort_profiles')
        .update({
          verified: 'pending',
          verification_date: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      
      setUploading(false);
      alert('Documento enviado para análise!');
    } catch (error) {
      handleSupabaseError(error, OperationType.UPLOAD, 'storage/verifications');
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 card space-y-6">
      <div className="text-center space-y-2">
        <Shield className="w-12 h-12 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Verificação de Identidade</h2>
        <p className="text-text-sub text-sm">Envie uma selfie segurando seu documento (BI ou Passaporte) para obter o selo de verificação.</p>
      </div>

      <div className="border-2 border-dashed border-inactive rounded-xl p-8 text-center space-y-4">
        {preview ? (
          <img src={preview} className="max-h-48 mx-auto rounded-lg shadow-md" />
        ) : (
          <div className="space-y-2">
            <Camera className="w-10 h-10 text-inactive mx-auto" />
            <p className="text-sm text-inactive">Clique para tirar foto ou selecionar arquivo</p>
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="file-upload" />
        <label htmlFor="file-upload" className="btn-secondary inline-block cursor-pointer">Selecionar Foto</label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full btn-primary py-3 flex items-center justify-center space-x-2"
      >
        {uploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <span>Enviar para Análise</span>}
      </button>
    </div>
  );
};

const AdminPanel = () => {
  const [pendingEscorts, setPendingEscorts] = useState<EscortProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data: escorts, error: escortsError } = await supabase
      .from('escort_profiles')
      .select('*')
      .eq('verified', 'pending');
    
    if (escortsError) {
      handleSupabaseError(escortsError, OperationType.GET, 'escort_profiles');
    } else {
      setPendingEscorts(escorts.map(e => ({
        id: e.id,
        userId: e.user_id,
        artisticName: e.artistic_name,
        city: e.city,
        verified: e.verified,
        age: e.age,
        mainPhotoUrl: e.main_photo_url
      } as EscortProfile)));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escort_profiles' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('escort_profiles')
        .update({ 
          verified: 'verified', 
          verification_date: new Date().toISOString() 
        })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'escort_profiles');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('escort_profiles')
        .update({ verified: 'unverified' })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'escort_profiles');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Painel de Administração</h1>
      
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center space-x-2">
          <Shield className="w-5 h-5 text-primary" />
          <span>Verificações Pendentes ({pendingEscorts.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingEscorts.map(escort => (
            <div key={escort.id} className="card p-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold">{escort.artisticName}</h3>
                <p className="text-sm text-text-sub">{escort.city} • {escort.age} anos</p>
                <div className="mt-2 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                   <img src={escort.mainPhotoUrl || `https://picsum.photos/seed/${escort.id}/400/225`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleApprove(escort.id)} className="flex-1 bg-verified text-white py-2 rounded-lg text-sm font-bold">Aprovar</button>
                <button onClick={() => handleReject(escort.id)} className="flex-1 bg-alert text-white py-2 rounded-lg text-sm font-bold">Rejeitar</button>
              </div>
            </div>
          ))}
          {pendingEscorts.length === 0 && <p className="text-text-sub italic">Nenhuma verificação pendente.</p>}
        </div>
      </section>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  const fetchUserData = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        type: data.type,
        status: data.status,
        createdAt: data.created_at,
        lastAccess: data.last_access
      } as User);
      setShowRoleSelection(false);
    } else {
      setShowRoleSelection(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserData(session.user.id);
      } else {
        setUser(null);
        setShowRoleSelection(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRoleSelect = async (type: UserType) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const newUser = {
      id: session.user.id,
      name: session.user.user_metadata.full_name || 'Utilizador',
      email: session.user.email || '',
      type,
      status: 'active',
      created_at: new Date().toISOString(),
      last_access: new Date().toISOString()
    };

    try {
      const { error: userError } = await supabase
        .from('users')
        .insert(newUser);
      
      if (userError) throw userError;

      if (type === 'escort') {
        const { error: profileError } = await supabase
          .from('escort_profiles')
          .insert({
            user_id: session.user.id,
            artistic_name: session.user.user_metadata.full_name || 'Novo Acompanhante',
            age: 18,
            city: 'Luanda',
            verified: 'pending',
            views: 0,
            rating: 5.0,
            main_photo_url: `https://picsum.photos/seed/${session.user.id}/600/800`
          });
        if (profileError) throw profileError;
      }

      fetchUserData(session.user.id);
    } catch (error) {
      handleSupabaseError(error, OperationType.CREATE, 'users/escort_profiles');
    }
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) handleSupabaseError(error, OperationType.GET, 'auth');
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) handleSupabaseError(error, OperationType.GET, 'auth');
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center space-y-6">
          <ShieldAlert className="w-16 h-16 text-alert mx-auto" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Configuração Necessária</h2>
            <p className="text-text-sub">
              As variáveis de ambiente da Supabase não foram encontradas.
            </p>
          </div>
          <div className="bg-black/5 p-4 rounded-lg text-left text-xs font-mono space-y-2">
            <p>1. Vá ao menu <strong>Settings</strong></p>
            <p>2. Adicione as seguintes variáveis:</p>
            <p className="text-primary">VITE_SUPABASE_URL</p>
            <p className="text-primary">VITE_SUPABASE_ANON_KEY</p>
          </div>
          <p className="text-xs text-inactive">
            Após configurar, a aplicação será reiniciada automaticamente.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showRoleSelection) {
    return (
      <Router>
        <div className="min-h-screen bg-bg-main">
          <Navbar user={null} onLogin={handleLogin} onLogout={handleLogout} />
          <RoleSelection onSelect={handleRoleSelect} />
        </div>
      </Router>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-bg-main">
          <Navbar user={user} onLogin={handleLogin} onLogout={handleLogout} />
          <main className="pb-20">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/escort/:id" element={<EscortProfilePage user={user} />} />
              <Route path="/chat/:id" element={<ChatPage user={user} />} />
              <Route path="/verification" element={<VerificationUpload user={user} />} />
              <Route path="/favorites" element={<div className="p-8">Favoritos (Em breve)</div>} />
              <Route path="/messages" element={<div className="p-8">Mensagens (Em breve)</div>} />
              <Route path="/profile" element={<div className="p-8">Meu Perfil (Em breve)</div>} />
              <Route path="/admin" element={<AdminPanel />} />
            </Routes>
          </main>
          
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 p-2 flex justify-center z-40">
            <div className="w-full max-w-[320px] h-[50px] bg-gray-100 border border-dashed border-inactive flex items-center justify-center text-[10px] text-inactive uppercase tracking-widest">
              Espaço Publicitário AdMob
            </div>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  );
}
