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
      await task();
    } catch (error) {
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
        `[${label}] Falling back to setTimeout${reason ? ` (${reason})` : ''}.`,
        error
      );
    }
    setTimeout(() => {
      void executeTask();
    }, 0);
  };

  if (scheduler) {
    try {
      scheduler(executeTask);
      return;
    } catch (error) {
      scheduleWithFallback('scheduler threw an error', error);
      return;
    }
  }

  scheduleWithFallback();
}
