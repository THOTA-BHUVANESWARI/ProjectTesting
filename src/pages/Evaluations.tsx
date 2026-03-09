import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Evaluation, Interview } from '@/types/database';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardCheck, 
  Calendar, 
  Star, 
  Eye,
  Filter,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface EvaluationWithInterview extends Evaluation {
  interview?: Interview;
}

export default function Evaluations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationWithInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    try {
      // First get evaluations
      const { data: evalData, error: evalError } = await supabase
        .from('evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (evalError) throw evalError;

      // Then get related interviews
      const interviewIds = (evalData || []).map(e => e.interview_id);
      const { data: interviewData } = await supabase
        .from('interviews')
        .select('*')
        .in('id', interviewIds);

      // Combine data
      const combined = (evalData || []).map(evaluation => ({
        ...evaluation,
        interview: interviewData?.find(i => i.id === evaluation.interview_id),
      }));

      setEvaluations(combined as EvaluationWithInterview[]);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    if (!recommendation) return null;
    
    const styles: Record<string, string> = {
      'Strong Hire': 'bg-success/20 text-success',
      'Hire': 'bg-primary/20 text-primary',
      'No Hire': 'bg-warning/20 text-warning',
      'Strong No Hire': 'bg-destructive/20 text-destructive',
    };

    return (
      <Badge variant="outline" className={cn('border-0', styles[recommendation])}>
        {recommendation}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold mb-2">Evaluations</h1>
            <p className="text-muted-foreground">Review and manage interview evaluations</p>
          </div>
        </div>

        {/* Evaluations List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : evaluations.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No evaluations yet</h3>
              <p className="text-muted-foreground mb-4">
                Evaluations will appear here after completing interviews
              </p>
              <Button variant="gradient" onClick={() => navigate('/interviews')}>
                View Interviews
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {evaluations.map((evaluation, i) => (
              <Card 
                key={evaluation.id}
                className="interview-card animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          {evaluation.interview?.title || 'Interview'}
                        </h3>
                        {getRecommendationBadge(evaluation.recommendation)}
                        {evaluation.submitted_at ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-0">
                            Submitted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-0">
                            Draft
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(evaluation.created_at), 'MMM d, yyyy')}
                        </span>
                        {evaluation.overall_rating && (
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-warning text-warning" />
                            {evaluation.overall_rating}/5
                          </span>
                        )}
                      </div>

                      {evaluation.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {evaluation.notes}
                        </p>
                      )}

                      {/* Score Summary */}
                      {Object.keys(evaluation.scores || {}).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(evaluation.scores as Record<string, number>).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {value}/5
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/interviews/${evaluation.interview_id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
