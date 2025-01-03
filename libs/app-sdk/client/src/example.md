```tsx
export function PersonComponent() {
  const [person, setPerson] = useState<Person | null>(null);

  useEffect(() => {
    const result = NodeSelection.find<Person>(Person)
      .where((person) => person.name === 'John')
      .withOperations(PersonNameOperations, PersonAgeOperations, PersonAddressOperations)
      .execute();

    const unsubscribe = result.subscribe((updatedPerson) => {
      setPerson(updatedPerson);
    });

    const nameOps = result.getImplFor(PersonNameOperations);
    const ageOps = result.getImplFor(PersonAgeOperations);
    const addressOps = result.getImplFor(PersonAddressOperations);

    nameOps.setName('Jane');
    ageOps.setAge(30);
    addressOps.setAddress('123 Main St');

    return () => unsubscribe();
  }, []);

  if (!person) return <div>Loading...</div>;

  return (
    <div>
      <h1>Person Details</h1>
      <p>Name: {person.name}</p>
      <p>Age: {person.age}</p>
      <p>Address: {person.address}</p>
    </div>
  );
}
```

```tsx
function useNodeSelection<T>(classType: new (...args: any[]) => T, predicate: (item: T) => boolean, operationsClasses: OperationsClass[]) {
  const [node, setNode] = useState<T | null>(null);
  const operationsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const result = NodeSelection.find<T>(classType)
      .where(predicate)
      .withOperations(...operationsClasses)
      .execute();

    // Initialize all operations
    operationsClasses.forEach((OperationsClass) => {
      operationsRef.current[OperationsClass.name] = result.getImplFor(OperationsClass);
    });

    const unsubscribe = result.subscribe(setNode);
    return () => unsubscribe();
  }, [classType, predicate]);

  return {
    node,
    operations: operationsRef.current,
  };
}

function PersonComponent() {
  const { node: person, operations } = useNodeSelection(Person, (person) => person.name === 'John', [PersonNameOperations, PersonAgeOperations, PersonAddressOperations]);

  if (!person) return <div>Loading...</div>;

  return (
    <div>
      <h1>Person Details</h1>
      <button onClick={() => operations.PersonNameOperations.setName('Jane')}>Change Name</button>
      {/* ... rest of the component ... */}
    </div>
  );
}
```
