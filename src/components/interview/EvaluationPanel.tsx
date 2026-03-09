import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { RubricTemplate, RubricCriteria, Evaluation, FeedbackNote } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Star, 
  Plus, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  Loader2,
  Send,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { z } from 'zod';

// Input validation schemas
const noteSchema = z.object({
  note: z.string().trim().min(1, 'Note is required').max(1000, 'Note must be less than 1000 characters'),
});

const evaluationSchema = z.object({
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional(),
  recommendation: z.string().max(100, 'Recommendation too long').optional(),
});

interface EvaluationPanelProps {
  interviewId: string;
  elapsedSeconds: number;
}

export function EvaluationPanel({ interviewId, elapsedSeconds }: EvaluationPanelProps) {
  const { user } = useAuth();
  const [rubric, setRubric] = useState<RubricTemplate | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState<FeedbackNote[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [overallRating, setOverallRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [interviewId]);

  useEffect(() => {
    // Subscribe to realtime feedback notes
    const channel = supabase
      .channel(`feedback-notes-${interviewId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_notes',
          filter: `interview_id=eq.${interviewId}`,
        },
        (payload) => {
          setFeedbackNotes(prev => [...prev, payload.new as FeedbackNote]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [interviewId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch default rubric
      const { data: rubricData } = await supabase
        .from('rubric_templates')
        .select('*')
        .eq('is_default', true)
        .single();

      if (rubricData) {
        const criteria = Array.isArray(rubricData.criteria) 
          ? rubricData.criteria as unknown as RubricCriteria[]
          : [];
        setRubric({ ...rubricData, criteria } as RubricTemplate);
        // Initialize scores
        const initialScores: Record<string, number> = {};
        criteria.forEach(c => {
          initialScores[c.name] = 3;
        });
        setScores(initialScores);
      }

      // Fetch existing evaluation
      const { data: evalData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('interview_id', interviewId)
        .eq('evaluator_id', user?.id)
        .single();

      if (evalData) {
        setEvaluation(evalData as Evaluation);
        setScores(evalData.scores as Record<string, number>);
        setNotes(evalData.notes || '');
        setOverallRating(evalData.overall_rating || 0);
        setRecommendation(evalData.recommendation || '');
      }

      // Fetch feedback notes
      const { data: notesData } = await supabase
        .from('feedback_notes')
        .select('*')
        .eq('interview_id', interviewId)
        .order('timestamp_seconds', { ascending: true });

      if (notesData) {
        setFeedbackNotes(notesData as FeedbackNote[]);
      }
    } catch (error) {
      console.error('Error fetching evaluation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTimestampedNote = async () => {
    if (!user) return;

    // Validate input
    const validation = noteSchema.safeParse({ note: newNote });
    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.errors[0]?.message || 'Invalid input',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('feedback_notes')
        .insert({
          interview_id: interviewId,
          evaluator_id: user.id,
          timestamp_seconds: elapsedSeconds,
          note: validation.data.note,
          category: noteCategory,
        });

      if (error) throw error;
      
      setNewNote('');
      toast({ title: 'Note added' });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: 'Error',
        description: 'Failed to add note.',
        variant: 'destructive',
      });
    }
  };

  const saveEvaluation = async (submit = false) => {
    if (!user || !rubric) return;

    // Validate input
    const validation = evaluationSchema.safeParse({ 
      notes: notes.trim() || undefined, 
      recommendation: recommendation.trim() || undefined 
    });
    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.errors[0]?.message || 'Invalid input',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const evalData = {
        interview_id: interviewId,
        evaluator_id: user.id,
        rubric_template_id: rubric.id,
        scores,
        notes: validation.data.notes || null,
        overall_rating: overallRating || null,
        recommendation: validation.data.recommendation || null,
        submitted_at: submit ? new Date().toISOString() : null,
      };

      if (evaluation) {
        await supabase
          .from('evaluations')
          .update(evalData)
          .eq('id', evaluation.id);
      } else {
        const { data } = await supabase
          .from('evaluations')
          .insert(evalData)
          .select()
          .single();
        
        if (data) {
          setEvaluation(data as Evaluation);
        }
      }

      toast({
        title: submit ? 'Evaluation submitted!' : 'Evaluation saved',
        description: submit ? 'The evaluation has been finalized.' : 'Your progress has been saved.',
      });
    } catch (error) {
      console.error('Error saving evaluation:', error);
      toast({
        title: 'Error',
        description: 'Failed to save evaluation.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const categories = ['general', 'positive', 'improvement', 'question'];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card rounded-xl overflow-hidden">
      <Tabs defaultValue="notes" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 justify-start">
          <TabsTrigger value="notes" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="rubric" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Rubric
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="flex-1 flex flex-col min-h-0 px-4 pb-4">
          {/* Add Note */}
          <Card className="mb-4 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-medium">{formatTime(elapsedSeconds)}</span>
              </div>
              
              <div className="flex gap-2 mb-3">
                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={noteCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNoteCategory(cat)}
                    className="capitalize text-xs"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Add a timestamped note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTimestampedNote()}
                  className="input-field"
                />
                <Button onClick={addTimestampedNote} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes List */}
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-4">
              {feedbackNotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No notes yet. Add timestamped feedback during the interview.
                </p>
              ) : (
                feedbackNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-primary font-medium">
                        {formatTime(note.timestamp_seconds)}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full capitalize",
                        note.category === 'positive' && 'bg-success/20 text-success',
                        note.category === 'improvement' && 'bg-warning/20 text-warning',
                        note.category === 'question' && 'bg-primary/20 text-primary',
                        (!note.category || note.category === 'general') && 'bg-muted text-muted-foreground'
                      )}>
                        {note.category || 'general'}
                      </span>
                    </div>
                    <p className="text-sm">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="rubric" className="flex-1 flex flex-col min-h-0 px-4 pb-4">
          <ScrollArea className="flex-1">
            <div className="space-y-6 pr-4">
              {/* Overall Rating */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Overall Rating</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setOverallRating(rating)}
                      className="rating-star"
                    >
                      <Star
                        className={cn(
                          "w-8 h-8 transition-colors",
                          rating <= overallRating
                            ? "fill-warning text-warning"
                            : "text-muted-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Criteria Scores */}
              {rubric && (rubric.criteria as RubricCriteria[]).map((criterion) => (
                <div key={criterion.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>{criterion.name}</Label>
                    <span className="text-sm font-medium text-primary">
                      {scores[criterion.name] || 3}/5
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{criterion.description}</p>
                  <Slider
                    value={[scores[criterion.name] || 3]}
                    onValueChange={([value]) => setScores({ ...scores, [criterion.name]: value })}
                    min={1}
                    max={5}
                    step={1}
                    className="py-2"
                  />
                </div>
              ))}

              {/* Notes */}
              <div className="space-y-2">
                <Label>General Notes</Label>
                <Textarea
                  placeholder="Overall impressions, strengths, areas for improvement..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field min-h-[100px]"
                />
              </div>

              {/* Recommendation */}
              <div className="space-y-2">
                <Label>Recommendation</Label>
                <div className="flex gap-2 flex-wrap">
                  {['Strong Hire', 'Hire', 'No Hire', 'Strong No Hire'].map((rec) => (
                    <Button
                      key={rec}
                      variant={recommendation === rec ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecommendation(rec)}
                    >
                      {rec}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => saveEvaluation(false)}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Draft
                </Button>
                <Button
                  variant="gradient"
                  className="flex-1"
                  onClick={() => saveEvaluation(true)}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Submit Evaluation
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
