import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, CalendarIcon, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const interviewSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().max(500).optional(),
  date: z.date({ required_error: 'Please select a date' }),
  time: z.string().min(1, 'Please select a time'),
  duration: z.number().min(15).max(180),
  candidateId: z.string().optional(),
});

export default function NewInterview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Profile[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: undefined as Date | undefined,
    time: '09:00',
    duration: 60,
    candidateId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'candidate');

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        setCandidates((profiles || []) as Profile[]);
      }
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  };

  const validateForm = () => {
    try {
      interviewSchema.parse({ ...formData, duration: Number(formData.duration) });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !formData.date) return;

    setLoading(true);

    try {
      const [hours, minutes] = formData.time.split(':');
      const scheduledAt = new Date(formData.date);
      scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Generate ABC-123 room code
      const letters = Array.from({ length: 3 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
      ).join('');
      const digits = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const roomCode = `${letters}-${digits}`;

      // Build insert payload — only include columns that exist in the schema
      const payload: Record<string, any> = {
        title: formData.title.trim(),
        scheduled_at: scheduledAt.toISOString(),
        status: 'scheduled',
        interviewer_id: user?.id,
        room_code: roomCode,
      };

      // Only add optional fields if they have values
      if (formData.description.trim()) {
        payload.description = formData.description.trim();
      }

      if (formData.candidateId && formData.candidateId !== 'none') {
        payload.candidate_id = formData.candidateId;
      }

      // Try with duration_minutes first, fall back without it
      const payloadWithDuration = { ...payload, duration_minutes: formData.duration };

      console.log('Inserting interview:', payloadWithDuration);

      let { error } = await supabase
        .from('interviews')
        .insert(payloadWithDuration);

      // If duration_minutes column doesn't exist, try without it
      if (error && (error.message?.includes('duration_minutes') || error.code === '42703')) {
        console.warn('duration_minutes column missing, inserting without it');
        const { error: error2 } = await supabase
          .from('interviews')
          .insert(payload);
        if (error2) throw error2;
      } else if (error) {
        throw error;
      }

      toast({
  title: 'Interview scheduled!',
  description: 'The interview has been created successfully.',
});
await new Promise(res => setTimeout(res, 800));
navigate('/interviews');
    } catch (error: any) {
      // Log the FULL error so we can see exactly what's failing
      console.error('Full error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error details:', error?.details);
      console.error('Error hint:', error?.hint);

      const description =
        error?.message?.includes('duration_minutes') ? 'Missing column. Run: ALTER TABLE interviews ADD COLUMN duration_minutes INT DEFAULT 60;' :
        error?.message?.includes('description') ? 'Missing column. Run: ALTER TABLE interviews ADD COLUMN description TEXT;' :
        error?.message?.includes('row-level security') ? 'Permission denied. Check your role assignment in Supabase.' :
        error?.message || 'Failed to create interview. Check browser console for details.';

      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <Button variant="ghost" onClick={() => navigate('/interviews')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Interviews
          </Button>
          <h1 className="text-3xl font-bold mb-2">Schedule Interview</h1>
          <p className="text-muted-foreground">Create a new interview session</p>
        </div>

        <Card className="glass-card animate-slide-up">
          <CardHeader>
            <CardTitle>Interview Details</CardTitle>
            <CardDescription>Fill in the information for the interview session</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Frontend Developer Interview"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the interview..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field min-h-[100px]"
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal input-field',
                          !formData.date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={(date) => setFormData({ ...formData, date })}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  <Select
                    value={formData.time}
                    onValueChange={(value) => setFormData({ ...formData, time: value })}
                  >
                    <SelectTrigger className="input-field">
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.time && <p className="text-sm text-destructive">{errors.time}</p>}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select
                  value={formData.duration.toString()}
                  onValueChange={(value) => setFormData({ ...formData, duration: parseInt(value) })}
                >
                  <SelectTrigger className="input-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Candidate Selection */}
              <div className="space-y-2">
                <Label htmlFor="candidate">Candidate (optional)</Label>
                <Select
                  value={formData.candidateId}
                  onValueChange={(value) => setFormData({ ...formData, candidateId: value })}
                >
                  <SelectTrigger className="input-field">
                    <SelectValue placeholder="Select a candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific candidate</SelectItem>
                    {candidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.full_name || candidate.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  You can assign a candidate later or share the room code
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/interviews')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="gradient"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Schedule Interview'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
