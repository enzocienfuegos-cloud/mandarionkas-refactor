export type Listener = () => void;

export type Store<TState, TCommand> = {
  getState: () => TState;
  subscribe: (listener: Listener) => () => void;
  dispatch: (command: TCommand) => void;
  replaceState: (nextState: TState) => void;
};

export function createStore<TState, TCommand>(options: {
  getInitialState: () => TState;
  reduce: (state: TState, command: TCommand) => TState;
  afterDispatch?: (command: TCommand, previousState: TState, nextState: TState) => void;
}): Store<TState, TCommand> {
  let state = options.getInitialState();
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(command) {
      const previousState = state;
      const next = options.reduce(state, command);
      if (next === state) return;
      state = next;
      options.afterDispatch?.(command, previousState, next);
      listeners.forEach((listener) => listener());
    },
    replaceState(nextState) {
      if (nextState === state) return;
      state = nextState;
      listeners.forEach((listener) => listener());
    },
  };
}
