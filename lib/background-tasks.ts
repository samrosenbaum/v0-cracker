interface BackgroundTaskOptions {
  label?: string;
  onError?: (error: unknown) => void;
  scheduler?: (callback: () => void | Promise<void>) => void;
}

type BackgroundTask = () => void | Promise<void>;

function logError(label: string, error: unknown) {
  console.error(`[${label}] Background task failed:`, error);
}

export function runBackgroundTask(
  task: BackgroundTask,
  options: BackgroundTaskOptions = {}
) {
  const { label = 'BackgroundTask', onError, scheduler } = options;

  const executeTask = async () => {
    try {
      console.log(`[${label}] ✓ Background task executing...`);
      await task();
      console.log(`[${label}] ✓ Background task completed successfully`);
    } catch (error) {
      console.error(`[${label}] ✗ Background task failed:`, error);
      if (onError) {
        try {
          onError(error);
        } catch (handlerError) {
          logError(label, handlerError);
        }
      } else {
        logError(label, error);
      }
    }
  };

  const scheduleWithFallback = (reason?: string, error?: unknown) => {
    if (reason) {
      console.warn(
        `[${label}] ⚠️  Falling back to setTimeout${reason ? ` (${reason})` : ''}.`,
        error
      );
    } else {
      console.log(`[${label}] Using setTimeout scheduler (no unstable_after provided)`);
    }
    setTimeout(() => {
      void executeTask();
    }, 0);
  };

  if (scheduler) {
    try {
      console.log(`[${label}] Scheduling with unstable_after...`);
      scheduler(executeTask);
      console.log(`[${label}] ✓ Successfully scheduled with unstable_after`);
      return;
    } catch (error) {
      console.error(`[${label}] ✗ unstable_after scheduler failed:`, error);
      scheduleWithFallback('scheduler threw an error', error);
      return;
    }
  }

  scheduleWithFallback();
}
