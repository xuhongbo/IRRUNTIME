let nextId = 1;

const createWorld = () => ({
  entities: new Set(),
  components: new Map(),
});

const defineComponent = () => Symbol("component");

const addEntity = (world) => {
  const id = nextId++;
  world.entities.add(id);
  return id;
};

const removeEntity = (world, eid) => {
  world.entities.delete(eid);
  for (const set of world.components.values()) {
    set.delete(eid);
  }
};

const addComponent = (world, eid, component) => {
  const set = world.components.get(component) ?? new Set();
  set.add(eid);
  world.components.set(component, set);
};

const removeComponent = (world, eid, component) => {
  world.components.get(component)?.delete(eid);
};

const hasComponent = (world, eid, component) => {
  return Boolean(world.components.get(component)?.has(eid));
};

module.exports = {
  createWorld,
  defineComponent,
  addEntity,
  removeEntity,
  addComponent,
  removeComponent,
  hasComponent,
};
