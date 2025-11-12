export const version = 'stub-1.0.0';
export const GlobalWorkerOptions = {};

export function getDocument() {
  const error = new Error('Invalid PDF structure.');
  error.name = 'InvalidPDFException';
  const rejection = Promise.reject(error);
  // Avoid unhandled rejection warnings
  rejection.catch(() => {});
  return {
    promise: rejection,
    destroy: async () => {},
  };
}
