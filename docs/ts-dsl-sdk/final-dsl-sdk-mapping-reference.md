# Finalna referencja mappingów DSL SDK -> Conversation / MyOS / PayNote

Status dokumentu: **finalna referencja implementacyjna v1**.

Ten dokument ma być używany jako:
- baza do implementacji pozostałych etapów DSL SDK po stage 2,
- źródło prawdy dla mappingów domenowych i platformowych,
- warstwa referencyjna ponad stage-1 / stage-2 core DSL.

Dokument **nie powtarza** wszystkich core mappingów builderowych z etapów 1–2 (`field`, `section`, `operation`, `onInit`, `updateDocument`, itd.).
Te pozostają zdefiniowane przez:
- finalne materiały stage 1,
- finalne materiały stage 2,
- aktualną implementację `libs/sdk-dsl`.

Ten dokument normuje przede wszystkim to, czego nie da się bezpiecznie wyprowadzić tylko z Java POC:
- **typy Conversation używane jako payloady / eventy / requesty / response’y**,
- **scenariusze MyOS i MyOS Admin**,
- **bootstrap**, **permissions**, **subscriptions**, **call-operation forwarding**, **participants**, **worker agency**, **anchors/links**,
- **AI / LLM-provider pattern**,
- **PayNote** wraz z aktualizacją wcześniejszej części paynote-only.

---

## 0. Źródła prawdy i zasady rozstrzygania konfliktów

### 0.1. Hierarchia źródeł prawdy

Na potrzeby tego dokumentu źródłem prawdy są, w tej kolejności:

1. **aktualne repo typów** `public repository schemas`:
   - `libs/types/src/packages/**/schemas/*.ts`
   - `libs/types/src/packages/**/blue-ids.ts`
2. **aktualny backend / runtime MyOS w `current MyOS runtime`**:
   - `docs/system/*.md`
   - `src/lib/blue/localRepository/definitions/*.blue`
   - testy integracyjne / jednostkowe dokumentujące runtime behavior
3. **feedback i aktualna implementacja current business-application flows** dla PayNote / Delivery / Mandate,
4. wcześniejsze docs / Java DSL POC – tylko pomocniczo, gdy nie są w konflikcie z 1–3.

### 0.2. Reguła konfliktu

Jeżeli wystąpi konflikt między:
- Java POC / starymi docs,
- a aktualnym `public repository schemas` lub aktualnym runtime `current MyOS runtime`,

to **wygrywają aktualne repo types i runtime**.

### 0.3. Legenda pewności

W dokumencie używam czterech poziomów pewności:

- **runtime-confirmed** – kształt jest potwierdzony zarówno przez aktualne repo types, jak i przez użycie / zachowanie backendu MyOS lub processor/runtime tests.
- **repo-confirmed** – kształt jest potwierdzony przez aktualne repo types, ale nie został jednoznacznie potwierdzony jako aktywnie używany w `current MyOS runtime`.
- **app-confirmed** – kształt jest potwierdzony przez aktualny flow aplikacyjny (np. current business-application flows), nawet jeśli nie jest centralnym flow w `current MyOS runtime`.
- **deferred** – po analizie nadal brakuje wystarczającej pewności, więc dokument nie zgaduje i nie promuje tego do natywnego helpera.

### 0.4. Co z tego wynika dla DSL SDK

Dla implementacji DSL SDK obowiązuje model:

- **repo/runtime-first** dla typów i payloadów,
- helpery DSL powinny być **cienką typed warstwą** nad istniejącymi typami,
- nie tworzymy lokalnych „quasi-typów”, jeżeli typ nie istnieje w repo,
- jeżeli typ istnieje w repo, ale backend narzuca dodatkowe semantyczne ograniczenia, helper może dodać guardraile / wygodne aliasy, ale nie powinien zmieniać shape payloadu.

---

## 1. Finalna odpowiedź na pytanie o stage 3 i dalsze etapy

### 1.1. Czy stage 3 potrzebuje finalnych mappingów dla scenariuszy MyOS?

**Tak.**

Stage 3 i dalsze etapy nie powinny być implementowane wyłącznie z Java DSL POC, bo:
- Java POC może używać nieistniejących lub przestarzałych typów,
- Java POC nie zna aktualnego runtime behavior MyOS Admin,
- część kluczowych flow (permissions, subscriptions, call forwarding, bootstrap, worker agency) jest w praktyce definiowana przez **backend MyOS** i aktualne **repo types**, a nie przez samą strukturę DSL z Java.

### 1.2. Czy mając finalne mappingi (wliczając PayNote) można zaimplementować wszystkie kroki planu DSL SDK?

**Tak – dla warstwy authoring DSL / runtime-driven mappings.**

To znaczy:
- stage 3 (MyOS admin + session interaction foundations),
- stage 4 (access / linked access / agency),
- stage 5 (AI / LLM-provider pattern),
- stage 6 (PayNote / payments),

mogą być zaimplementowane na podstawie tego dokumentu + wcześniejszych materiałów stage 1/2.

**Wyjątek:** część „editing pipeline” (`DocStructure`, `DocPatch`, `BlueChangeCompiler`, generator/change-request tooling) nadal wymaga osobnej specyfikacji zachowania edycyjnego. To nie jest problem mappingów MyOS/PayNote, tylko osobna warstwa produktowa.

---

## 2. Decyzje globalne dla finalnych mappingów DSL

## 2.1. Jawne kanały w runtime documents

Jeżeli DSL materializuje kanały explicite dla dokumentów działających w MyOS, to obecnie jedynym realnie wspieranym i używanym typem kanału jest:

```yaml
type: MyOS/MyOS Timeline Channel
```

To dotyczy w szczególności:
- owner / payer / payee / guarantor / granter / grantee kanałów,
- `myOsAdminChannel`,
- kanałów w document bootstrap / worker session bootstrap,
- jawnie materializowanych participant channels.

Uwaga: istnieją też ogólne typy `Core/Channel` i `Conversation/Timeline Channel`, ale dla runtime MyOS flows dokumenty aplikacyjne i systemowe operują w praktyce na `MyOS/MyOS Timeline Channel`.

## 2.2. `requestId`

`requestId` ma status:
- **opcjonalnego business correlation id**,
- a nie obowiązkowego klucza idempotencji.

Helpery DSL powinny więc:
- wspierać `requestId` wszędzie tam, gdzie typ repo na to pozwala,
- ale nie uzależniać od niego poprawności podstawowego flow.

## 2.3. `Common/Named Event` w aktualnym repo

W aktualnym `public repository schemas` typ `Common/Named Event` jest dostępny i powinien być używany bez fallbacku do `Conversation/Event`.

Wniosek implementacyjny:
- named-event DSL materializuje `type: Common/Named Event`,
- pola named eventu trafiają na root instancji,
- `name` pozostaje głównym polem dopasowania,
- dodatkowe pola event-specific są również root-level, a nie pod `payload`.

## 2.4. Nie duplikować kontraktów odziedziczonych z typu

Jeżeli typ dokumentu już zapewnia kontrakty przez dziedziczenie lub definicję typu, helper domenowy nie powinien ich domyślnie materializować drugi raz.

Dotyczy to m.in.:
- `MyOS/MyOS Admin Base`,
- `MyOS/Single Document Permission Grant To Account`,
- `MyOS/Single Document Permission Grant To Document`,
- `MyOS/Linked Documents Permission Grant To Account`,
- `MyOS/Linked Documents Permission Grant To Document`,
- `MyOS/Worker Agency Permission Grant`,
- `PayNote/PayNote`,
- `PayNote/PayNote Delivery`,
- `PayNote/Payment Mandate`.

Helper może wystawić:
- explicit override,
- explicit extension,
- generic `.field(...)`, `.channel(...)`, `.raw(...)`, `.ext(...)`,
ale nie powinien dublować wbudowanej logiki typu bez potrzeby.

## 2.5. Rozdzielić trzy różne rzeczy, które łatwo pomylić

W finalnym DSL trzeba rozdzielić:

1. **Blue document / contract / event shape** – to normuje głównie repo.
2. **Runtime semantics** – to normuje backend / processor / admin.
3. **HTTP endpoint payloads** – to nie zawsze jest to samo co event Blue.

Najważniejszy przykład:
- `Conversation/Document Bootstrap Requested` to **Blue event type**,
- bootstrap endpoint w `current MyOS runtime` przyjmuje osobny request payload,
- `MyOS/Document Session Bootstrap` to osobny, wewnętrzny dokument bootstrap tracking.

DSL helper nie powinien mieszać tych warstw.

---

## 3. Conversation – finalne mappingi ogólne

## 3.1. Typy bazowe

### `Conversation/Event`
Status: **runtime-confirmed**

Minimalny shape:

```yaml
type: Conversation/Event
```

Dopuszczalne pola bazowe:

```yaml
type: Conversation/Event
name: <optional text>
description: <optional text>
```

Semantyka:
- ogólny event domenowy,
- może być używany jako payload triggerowany przez workflow,
- może być używany jako wzorzec subskrypcji / matchera,
- jest także bazą dla subtype events (`Request`, `Response`, `Chat Message`, `Status Change`, MyOS events dziedziczące po `Response` / `Request`).

### `Conversation/Request`
Status: **runtime-confirmed**

```yaml
type: Conversation/Request
requestId: <optional text>
name: <optional text>
description: <optional text>
```

### `Conversation/Response`
Status: **runtime-confirmed**

```yaml
type: Conversation/Response
inResponseTo: <optional blue node / correlation block>
name: <optional text>
description: <optional text>
```

`inResponseTo` jest polem generycznym i może zawierać np.:
- `requestId`,
- `incomingEvent`,
- inny Blue node używany do korelacji.

### `Conversation/Chat Message`
Status: **runtime-confirmed**

```yaml
type: Conversation/Chat Message
message: <optional text>
name: <optional text>
description: <optional text>
```

Runtime note:
- processor traktuje `Conversation/Chat Message` jako event feed-worthy,
- feed entries są budowane także z `Status Change` i `Inform User About Pending Action`.

## 3.2. Operacje, workflowy i kroki

Te core mappingi pozostają zgodne z wcześniejszymi etapami, ale finalnie obowiązują następujące shapes:

### `Conversation/Operation`
Status: **runtime-confirmed**

```yaml
type: Conversation/Operation
channel: <channelKey>
request: <optional blue node>
name: <optional text>
description: <optional text>
```

### `Conversation/Sequential Workflow`
Status: **runtime-confirmed**

```yaml
type: Conversation/Sequential Workflow
channel: <optional channelKey>
event: <optional blue node matcher>
steps:
  - <SequentialWorkflowStep>
name: <optional text>
description: <optional text>
```

DSL note:
- `DocBuilder.workflow(...)` is the thin generic builder for this contract type,
- it materializes exactly one `Conversation/Sequential Workflow`,
- it preserves the matcher shape authored by the caller.

### `Conversation/Sequential Workflow Operation`
Status: **runtime-confirmed**

```yaml
type: Conversation/Sequential Workflow Operation
operation: <operationKey>
steps:
  - <SequentialWorkflowStep>
name: <optional text>
description: <optional text>
```

### `Conversation/Trigger Event`
Status: **runtime-confirmed**

```yaml
type: Conversation/Trigger Event
event: <blue node>
name: <optional text>
description: <optional text>
```

### `Conversation/Update Document`
Status: **runtime-confirmed**

```yaml
type: Conversation/Update Document
changeset:
  - type: Core/Json Patch Entry   # optional in raw shape; processor accepts patch entries
    op: <string>
    path: <json pointer or expression>
    val: <optional blue node / primitive / expression>
name: <optional text>
description: <optional text>
```

### `Conversation/JavaScript Code`
Status: **runtime-confirmed**

```yaml
type: Conversation/JavaScript Code
code: |
  <js code>
name: <optional text>
description: <optional text>
```

## 3.3. Statusy dokumentu i feed-driven events

### `Conversation/Document Status`
Status: **repo-confirmed**

```yaml
type: Conversation/Document Status
mode: <optional text>
name: <optional text>
description: <optional text>
```

Najczęściej używane subtype statuses:
- `Conversation/Status Pending`
- `Conversation/Status In Progress`
- `Conversation/Status Completed`
- `Conversation/Status Failed`

### `Conversation/Status Change`
Status: **runtime-confirmed**

```yaml
type: Conversation/Status Change
status:
  type: Conversation/Status Completed | Conversation/Status Failed | Conversation/Status In Progress | Conversation/Status Pending | <other Document Status subtype>
name: <optional text>
description: <optional text>
```

Runtime note:
- processor mapuje `Status Change` do feed entry,
- `MyOS/Document Session Bootstrap` używa `Status Change` do centralnego śledzenia bootstrap status.

## 3.4. Pending actions i customer interactions

### `Conversation/Inform User About Pending Action`
Status: **runtime-confirmed**

```yaml
type: Conversation/Inform User About Pending Action
channel: <channelKey>
operation: <operationKey>
expectedRequest: <optional blue node>
message: <optional text>
title: <optional text>
name: <optional text>
description: <optional text>
```

Runtime semantics (ważne):
- sam schema ma pola opcjonalne,
- ale **pending action draft** jest tworzony tylko jeśli runtime znajdzie jednocześnie:
  - `channel`,
  - `operation`,
  - timeline odpowiadający temu kanałowi.
- runtime serializuje wskazaną operację dokumentu do pending action payload.

Wniosek dla DSL:
- helper `steps.conversation.informUserAboutPendingAction(...)` powinien wymagać co najmniej `channel` i `operation`,
- `expectedRequest`, `message`, `title` powinny być opcjonalne.

### `Conversation/Customer Action Requested`
Status: **repo-confirmed**

```yaml
type: Conversation/Customer Action Requested
message: <optional text>
title: <optional text>
name: <optional text>
description: <optional text>
actions:
  - label: <optional text>
    variant: <optional text>
    inputTitle: <optional text>
    inputPlaceholder: <optional text>
    inputRequired: <optional boolean>
    inputSchema: <optional blue node>
```

Runtime note:
- po analizie `current MyOS runtime` nie potwierdzono jeszcze aktywnego backendowego flow opartego o ten typ,
- ale typ istnieje w aktualnym repo, więc mapping DSL powinien odpowiadać repo dokładnie.

Wniosek dla DSL:
- można dodać typed helper dla customer action request/response,
- ale bez zgadywania dodatkowych runtime semantics ponad repo schema.

### `Conversation/Customer Action Responded`
Status: **repo-confirmed**

```yaml
type: Conversation/Customer Action Responded
actionLabel: <optional text>
input: <optional blue node>
respondedAt: <optional Common/Timestamp>
name: <optional text>
description: <optional text>
inResponseTo: <optional blue node>
```

## 3.5. Bootstrap-related Conversation events

### `Conversation/Document Bootstrap Requested`
Status: **repo-confirmed**

```yaml
type: Conversation/Document Bootstrap Requested
requestId: <optional text>
bootstrapAssignee: <optional channelKey>
name: <optional text>
description: <optional text>
document: <optional blue node>
channelBindings: <optional record>
initialMessages:
  defaultMessage: <optional text>
  description: <optional text>
  perChannel:
    <channelKey>: <text>
```

**Ważna uwaga:**

To jest **event repo-native**, ale w `current MyOS runtime` nie znaleziono aktywnego backendowego flow, który bezpośrednio konsumuje ten event jako główny bootstrap entrypoint.

Jednocześnie `current MyOS runtime` ma:
- bootstrap **endpoint**,
- oraz wewnętrzny dokument `MyOS/Document Session Bootstrap`.

Nie należy więc utożsamiać:
- eventu `Conversation/Document Bootstrap Requested`,
- z payloadem bootstrap endpointu,
- ani z wewnętrznym dokumentem bootstrapowym.

### `Conversation/Document Bootstrap Responded`
Status: **repo-confirmed**

```yaml
type: Conversation/Document Bootstrap Responded
status: <optional text>
reason: <optional text>
name: <optional text>
description: <optional text>
inResponseTo: <optional blue node>
```

### `Conversation/Document Bootstrap Completed`
Status: **repo-confirmed**

```yaml
type: Conversation/Document Bootstrap Completed
documentId: <optional text>
name: <optional text>
description: <optional text>
inResponseTo: <optional blue node>
```

### `Conversation/Document Bootstrap Failed`
Status: **repo-confirmed**

```yaml
type: Conversation/Document Bootstrap Failed
reason: <optional text>
name: <optional text>
description: <optional text>
inResponseTo: <optional blue node>
```

## 3.6. Change lifecycle

### `Conversation/Contracts Change Policy`
Status: **repo-confirmed**

```yaml
type: Conversation/Contracts Change Policy
requireSectionChanges: <optional boolean>
name: <optional text>
description: <optional text>
```

### `Conversation/Change Request`
Status: **repo-confirmed**

```yaml
type: Conversation/Change Request
summary: <optional text>
changeset:
  - <Core/Json Patch Entry>
sectionChanges:
  type: Conversation/Document Section Changes
  add:
    - <Document Section Change Entry>
  modify:
    - <Document Section Change Entry>
  remove:
    - <sectionKey>
name: <optional text>
description: <optional text>
```

### `Conversation/Change Operation` + `Conversation/Change Workflow`
Status: **repo-confirmed**

`Change Operation`:

```yaml
type: Conversation/Change Operation
channel: <channelKey>
request:
  type: Conversation/Change Request
```

`Change Workflow`:

```yaml
type: Conversation/Change Workflow
operation: <changeOperationKey>
request:
  type: Conversation/Change Request   # optional materialization
steps: <runtime-defined or empty>
```

### `Conversation/Propose Change Operation` + `Conversation/Propose Change Workflow`
Status: **repo-confirmed**

```yaml
type: Conversation/Propose Change Operation
channel: <channelKey>
request:
  type: Conversation/Change Request
```

```yaml
type: Conversation/Propose Change Workflow
operation: <operationKey>
postfix: <optional text>
request:
  type: Conversation/Change Request
steps: <optional runtime-defined>
```

### `Conversation/Accept Change Operation` / `Workflow`
Status: **repo-confirmed**

```yaml
type: Conversation/Accept Change Operation
channel: <channelKey>
```

```yaml
type: Conversation/Accept Change Workflow
operation: <operationKey>
postfix: <optional text>
steps: <optional runtime-defined>
```

### `Conversation/Reject Change Operation` / `Workflow`
Status: **repo-confirmed**

```yaml
type: Conversation/Reject Change Operation
channel: <channelKey>
```

```yaml
type: Conversation/Reject Change Workflow
operation: <operationKey>
postfix: <optional text>
steps: <optional runtime-defined>
```

Wniosek dla DSL:
- helpery `directChange`, `proposeChange`, `acceptChange`, `rejectChange`, `contractsPolicy` mogą być implementowane w oparciu o aktualne repo schema bez dodatkowych MyOS-specific typów.

---

## 4. Core / MyOS wspólne typy kanałów i markerów

## 4.1. `Core/Channel`
Status: **repo-confirmed**

```yaml
type: Core/Channel
event: <optional blue node>
name: <optional text>
description: <optional text>
```

## 4.2. `Conversation/Timeline Channel`
Status: **repo-confirmed**

```yaml
type: Conversation/Timeline Channel
timelineId: <optional text>
name: <optional text>
description: <optional text>
```

Runtime note:
- workflow listeners bound to timeline-like channels receive timeline entries,
- DSL matchers for `onChannelEvent(...)` should still be authored against the
  underlying message or event type,
- timeline-aware materialization adapts those matchers under `event.message`.
- generic `workflow(...)` authoring does not apply that convenience adaptation
  automatically; for thin generic workflows on timeline-like channels, callers
  should author the runtime-confirmed matcher shape directly.

## 4.3. `MyOS/MyOS Timeline Channel`
Status: **runtime-confirmed**

```yaml
type: MyOS/MyOS Timeline Channel
accountId: <optional text>
email: <optional text>
timelineId: <optional text>
name: <optional text>
description: <optional text>
```

Runtime notes:
- to jest podstawowy kanał uczestnika w MyOS,
- binding może być częściowy (`accountId`, `email`, lub `accountId + timelineId`),
- w wielu flow backend normalizuje bindingi do `{ accountId?, email?, timelineId? }`.
- workflow listeners bound to this channel also receive timeline entries, so DSL
  matchers for `onChannelEvent(...)` are authored against the underlying
  message or event and materialized under `event.message`.

## 4.4. `Core/Lifecycle Event Channel`
Status: **runtime-confirmed**

```yaml
type: Core/Lifecycle Event Channel
event:
  type: Core/Document Processing Initiated | <other lifecycle event>
name: <optional text>
description: <optional text>
```

Najczęstszy case:

```yaml
type: Core/Lifecycle Event Channel
event:
  type: Core/Document Processing Initiated
```

## 4.5. `Core/Triggered Event Channel`
Status: **runtime-confirmed**

```yaml
type: Core/Triggered Event Channel
name: <optional text>
description: <optional text>
```

To jest standardowy kanał dla:
- MyOS admin updates re-emitted by `myOsAdminUpdate`,
- `Subscription Update`,
- `Call Operation Accepted/Failed/Responded`,
- `Participant Resolved`,
- `Target Document Session Started`,
- innych eventów dostarczonych przez admin / triggered path.

## 4.6. `Core/Document Update Channel`
Status: **runtime-confirmed**

```yaml
type: Core/Document Update Channel
path: <json pointer>
name: <optional text>
description: <optional text>
```

## 4.7. `Core/Process Embedded`
Status: **runtime-confirmed**

```yaml
type: Core/Process Embedded
paths:
  - /emb
name: <optional text>
description: <optional text>
```

---

## 5. MyOS – finalne mappingi platformowe

## 5.1. `MyOS/MyOS Admin Base`
Status: **runtime-confirmed**

Typ zapewnia minimalny zestaw kontraktów administracyjnych.

Repo-confirmed shape:

```yaml
type: MyOS/MyOS Admin Base
contracts:
  myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel
  myOsAdminUpdate:
    type: Conversation/Operation
  myOsAdminUpdateImpl:
    type: Conversation/Sequential Workflow Operation
```

Runtime-confirmed minimalny manualny shape dla dokumentu, który **nie** ma typu `MyOS/MyOS Admin Base`, ale ma działać z admin flow:

```yaml
contracts:
  myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel

  myOsAdminUpdate:
    type: Conversation/Operation
    description: The standard, required operation for MyOS Admin to deliver events.
    channel: myOsAdminChannel

  myOsAdminUpdateImpl:
    type: Conversation/Sequential Workflow Operation
    description: Implementation that re-emits the provided events
    operation: myOsAdminUpdate
    steps:
      - name: EmitAdminEvents
        type: Conversation/JavaScript Code
        code: |
          return { events: event.message.request };
```

Wnioski dla DSL:
- `myOsAdmin(...)` powinno być helperem skrótowym dla powyższego zestawu kontraktów,
- jeżeli dokument ma już typ `MyOS/MyOS Admin Base`, helper nie powinien dublować kontraktów,
- `myOsAdminUpdate` może materializować `request: { type: List }`, ale jest to
  zawężenie semantyczne helpera do listy eventów do re-emisji, a nie wymóg
  samego runtime dla requestless `Conversation/Sequential Workflow Operation`.

## 5.2. Session interaction – requesty i update wrappers

### `MyOS/Single Document Permission Grant Requested`
Status: **runtime-confirmed**

```yaml
type: MyOS/Single Document Permission Grant Requested
requestId: <optional text>
onBehalfOf: <optional channelKey>
targetSessionId: <optional text>
permissions:
  type: MyOS/Single Document Permission Set
  read: <optional boolean>
  share: <optional boolean>
  allOps: <optional boolean>
  singleOps:
    - <operationKey>
name: <optional text>
description: <optional text>
```

Runtime semantics:
- MyOS Admin tworzy pending action / grant flow,
- korelacja odpowiedzi używa `inResponseTo` zawierającego request BlueId oraz opcjonalny `requestId`.

### `MyOS/Single Document Permission Granting in Progress`
Status: **runtime-confirmed**

```yaml
type: MyOS/Single Document Permission Granting in Progress
permissions: <optional Single Document Permission Set>
targetSessionId: <optional text>
note: <optional text>
inResponseTo: <optional correlation block>
```

### `MyOS/Single Document Permission Granted`
Status: **runtime-confirmed**

```yaml
type: MyOS/Single Document Permission Granted
permissions: <optional Single Document Permission Set>
targetSessionId: <optional text>
inResponseTo: <optional correlation block>
```

### `MyOS/Single Document Permission Rejected`
Status: **runtime-confirmed**

```yaml
type: MyOS/Single Document Permission Rejected
permissions: <optional Single Document Permission Set>
targetSessionId: <optional text>
reason: <optional text>
inResponseTo: <optional correlation block>
```

### `MyOS/Single Document Permission Invalid`
Status: **runtime-confirmed**

```yaml
type: MyOS/Single Document Permission Invalid
issues:
  - <text>
name: <optional text>
description: <optional text>
```

### `MyOS/Single Document Permission Revoke Requested`
Status: **runtime-confirmed**

```yaml
type: MyOS/Single Document Permission Revoke Requested
requestId: <optional text>
reason: <optional text>
name: <optional text>
description: <optional text>
```

### `MyOS/Single Document Permission Revoking in Progress` / `Revoked`
Status: **runtime-confirmed**

`Revoking in Progress`:

```yaml
type: MyOS/Single Document Permission Revoking in Progress
note: <optional text>
inResponseTo: <optional correlation block>
```

`Revoked`:

```yaml
type: MyOS/Single Document Permission Revoked
inResponseTo: <optional correlation block>
```

## 5.3. `MyOS/Linked Documents Permission Grant Requested` i odpowiedzi

### Request
Status: **runtime-confirmed**

```yaml
type: MyOS/Linked Documents Permission Grant Requested
requestId: <optional text>
onBehalfOf: <optional channelKey>
targetSessionId: <optional text>
links:
  type: MyOS/Linked Documents Permission Set
  <anchorKey>:
    read: <optional boolean>
    share: <optional boolean>
    allOps: <optional boolean>
    singleOps:
      - <operationKey>
name: <optional text>
description: <optional text>
```

### Responses / control events
Status: **runtime-confirmed**

`Granting in Progress`:

```yaml
type: MyOS/Linked Documents Permission Granting in Progress
links: <optional Linked Documents Permission Set>
targetSessionId: <optional text>
inResponseTo: <optional correlation block>
```

`Granted`:

```yaml
type: MyOS/Linked Documents Permission Granted
links: <optional Linked Documents Permission Set>
targetSessionId: <optional text>
inResponseTo: <optional correlation block>
```

`Rejected`:

```yaml
type: MyOS/Linked Documents Permission Rejected
links: <optional Linked Documents Permission Set>
targetSessionId: <optional text>
reason: <optional text>
inResponseTo: <optional correlation block>
```

`Invalid`:

```yaml
type: MyOS/Linked Documents Permission Invalid
issues:
  - <text>
```

`Revoke Requested`:

```yaml
type: MyOS/Linked Documents Permission Revoke Requested
requestId: <optional text>
reason: <optional text>
```

`Revoking in Progress` / `Revoked` analogicznie do SDPG.

## 5.4. `MyOS/Subscribe to Session Requested` i update envelope

### Request
Status: **runtime-confirmed**

```yaml
type: MyOS/Subscribe to Session Requested
requestId: <optional text>
targetSessionId: <optional text>
subscription:
  id: <optional text>
  events:
    - <optional blue node pattern>
name: <optional text>
description: <optional text>
```

Runtime semantics z ADR-008:
- `subscription.events == undefined` => match all emitted events,
- `subscription.events == []` => match none, ale wciąż forwardowane są epoch snapshots,
- `subscription.events` niepuste => match by `matchesEventPattern(...)` z dziedziczeniem typów Blue.

### `MyOS/Subscription to Session Initiated`
Status: **runtime-confirmed**

```yaml
type: MyOS/Subscription to Session Initiated
subscriptionId: <optional text>
targetSessionId: <optional text>
document: <optional blue node snapshot>
epoch: <optional number>
at: <optional timestamp text>
inResponseTo: <optional correlation block>
```

Ważne:
- ten event daje initial snapshot (`document`, `epoch`),
- jest **control-plane eventem**, nie jest opakowany w `Subscription Update`.

### `MyOS/Subscription to Session Failed`
Status: **runtime-confirmed**

```yaml
type: MyOS/Subscription to Session Failed
subscriptionId: <optional text>
targetSessionId: <optional text>
reason: <optional text>
inResponseTo: <optional correlation block>
```

### `MyOS/Subscription to Session Revoked`
Status: **runtime-confirmed**

```yaml
type: MyOS/Subscription to Session Revoked
subscriptionId: <optional text>
targetSessionId: <optional text>
reason: <optional text>
inResponseTo: <optional correlation block>
```

### `MyOS/Subscription Update`
Status: **runtime-confirmed**

```yaml
type: MyOS/Subscription Update
subscriptionId: <optional text>
targetSessionId: <optional text>
update: <blue node>
name: <optional text>
description: <optional text>
```

Runtime semantics z ADR-008:
- `update` jest albo:
  - `MyOS/Session Epoch Advanced`,
  - albo emitowanym eventem z target document, który pasuje do wzorca subskrypcji.
- **każdy epoch** target session generuje co najmniej jeden `Subscription Update` z `update.type = MyOS/Session Epoch Advanced`.
- control-plane events (`Initiated`, `Failed`, `Revoked`) nie są opakowane w `Subscription Update`.

### `MyOS/Session Epoch Advanced`
Status: **runtime-confirmed**

```yaml
type: MyOS/Session Epoch Advanced
sessionId: <optional text>
epoch: <optional number>
timestamp: <optional text>
document: <optional blue node snapshot>
name: <optional text>
description: <optional text>
```

## 5.5. `MyOS/Call Operation Requested` i response forwarding

### Request
Status: **runtime-confirmed**

```yaml
type: MyOS/Call Operation Requested
requestId: <optional text>
onBehalfOf: <optional channelKey>
targetSessionId: <optional text>
operation: <optional operationKey>
request: <optional blue node>
name: <optional text>
description: <optional text>
```

### `MyOS/Call Operation Accepted`
Status: **runtime-confirmed**

```yaml
type: MyOS/Call Operation Accepted
operation: <optional operationKey>
targetSessionId: <optional text>
inResponseTo:
  incomingEvent: <request blueId>
  requestId: <optional original requestId>
```

### `MyOS/Call Operation Failed`
Status: **runtime-confirmed**

```yaml
type: MyOS/Call Operation Failed
operation: <optional operationKey>
targetSessionId: <optional text>
reason: <optional text>
inResponseTo:
  incomingEvent: <request blueId>
  requestId: <optional original requestId>
```

### `MyOS/Call Operation Responded`
Status: **runtime-confirmed**

```yaml
type: MyOS/Call Operation Responded
events:
  - <Conversation/Response>
inResponseTo:
  incomingEvent: <request blueId>
  requestId: <optional original requestId>
name: <optional text>
description: <optional text>
```

Runtime semantics z ADR-023:
- MyOS Admin zawsze forwarduje **jeden wrapper** `Call Operation Responded`,
- `events` zawiera wszystkie `Conversation/Response` wyemitowane przez target document dla tego calla,
- wrapper jest wysyłany **nawet jeśli `events` jest puste**,
- forwarding nie jest wyłączany tylko dlatego, że caller ma już aktywną subskrypcję.

To jest kluczowy mapping dla helperów typu:
- `steps.myOs().callOperationRequested(...)`,
- `onMyOsResponse(...)`,
- `onSubscriptionUpdate(...)` dla AI / cross-document flows.

## 5.6. Anchors i links

### `MyOS/Document Anchors`
Status: **runtime-confirmed**

```yaml
contracts:
  anchors:
    type: MyOS/Document Anchors
    anchorA:
      type: MyOS/Document Anchor
      template: <optional blue node>
```

### `MyOS/Document Links`
Status: **runtime-confirmed**

```yaml
contracts:
  links:
    type: MyOS/Document Links
    link1:
      type: MyOS/MyOS Session Link | MyOS/Document Link | MyOS/Document Type Link
      anchor: <anchorKey>
      sessionId: <optional text>
      documentId: <optional text>
      documentType: <optional blue node>
```

Wspierane subtype linków:
- `MyOS/MyOS Session Link`
- `MyOS/Document Link`
- `MyOS/Document Type Link`

Runtime semantics:
- `current MyOS runtime` parsuje links z `contracts` i rozróżnia link type jako:
  - SESSION,
  - DOCUMENT,
  - DOCUMENT_TYPE.
- `Document Anchors` i `Document Links` są też rozpoznawane przez processor / contract loader jako marker-like contracts.

## 5.7. Participants orchestration

### Marker contract
Status: **runtime-confirmed**

```yaml
contracts:
  participantsOrchestration:
    type: MyOS/MyOS Participants Orchestration
```

### Eventy
Status: **runtime-confirmed**

`MyOS/Adding Participant Requested`:

```yaml
type: MyOS/Adding Participant Requested
requestId: <optional text>
channelName: <optional text>
participantBinding:
  accountId: <optional text>
  email: <optional text>
name: <optional text>
```

`MyOS/Adding Participant Responded`:

```yaml
type: MyOS/Adding Participant Responded
request: <optional Adding Participant Requested>
status: <optional text>
inResponseTo: <optional correlation block>
```

`MyOS/Participant Resolved`:

```yaml
type: MyOS/Participant Resolved
channelName: <optional text>
participant:
  type: MyOS/Participant
  accountId: <optional text>
  email: <optional text>
  timelineId: <optional text>
  status:
    type: MyOS/Participant Activation State
    accountStatus: <optional text>
    errorMessage: <optional text>
```

`MyOS/Removing Participant Requested`:

```yaml
type: MyOS/Removing Participant Requested
requestId: <optional text>
channelName: <optional text>
```

`MyOS/Removing Participant Responded`:

```yaml
type: MyOS/Removing Participant Responded
request: <optional Removing Participant Requested>
status: <optional text>
inResponseTo: <optional correlation block>
```

### Canonical orchestration document pattern
Status: **runtime-confirmed**

Dla DSL helpera participants orchestration należy przyjąć wzorzec dokumentu:

- dokument typu `MyOS/MyOS Admin Base`,
- `ownerChannel`, `triggeredEventChannel`, `initLifecycleChannel`,
- marker `MyOS/MyOS Participants Orchestration`,
- operation `dispatchParticipantAddition` + impl emitująca `MyOS/Adding Participant Requested`,
- operation `dispatchParticipantRemoval` + impl emitująca `MyOS/Removing Participant Requested`,
- workflow `addApprovedParticipant` reagujący na `MyOS/Participant Resolved` i dodający kanał do `/contracts`,
- workflow `removeApprovedParticipant` reagujący na `MyOS/Removing Participant Responded` i usuwający kanał z `/contracts`.

To jest dokładnie ten wzorzec, który potwierdzają integration tests w `current MyOS runtime`.

## 5.8. Worker agency

### Marker contract
Status: **repo-confirmed**

```yaml
contracts:
  workerAgency:
    type: MyOS/MyOS Worker Agency
```

### `MyOS/Worker Agency Permission`
Status: **runtime-confirmed**

```yaml
type: MyOS/Worker Agency Permission
workerType: <blue node or type reference>
permissions:
  type: MyOS/Single Document Permission Set
  read: <optional boolean>
  share: <optional boolean>
  allOps: <optional boolean>
  singleOps:
    - <operationKey>
name: <optional text>
```

### `MyOS/Worker Agency Permission Grant Requested`
Status: **runtime-confirmed**

```yaml
type: MyOS/Worker Agency Permission Grant Requested
requestId: <optional text>
onBehalfOf: <optional channelKey>
allowedWorkerAgencyPermissions:
  - type: MyOS/Worker Agency Permission
    workerType: <blue node or type ref>
    permissions: <Single Document Permission Set>
name: <optional text>
description: <optional text>
```

### `MyOS/Worker Agency Permission Grant` document
Status: **runtime-confirmed**

```yaml
name: <name>
type: MyOS/Worker Agency Permission Grant
granteeDocumentId: <optional text>
allowedWorkerAgencyPermissions:
  - type: MyOS/Worker Agency Permission
    workerType: <blue node or type ref>
    permissions: <Single Document Permission Set>
contracts:
  granterChannel:
    type: MyOS/MyOS Timeline Channel
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  revoke:
    type: Conversation/Operation
    channel: granterChannel
  revokeImplGranter:
    type: Conversation/Sequential Workflow Operation
    operation: revoke
  validateOnInit:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
```

### Response / control events
Status: **runtime-confirmed**

`Granting in Progress`:

```yaml
type: MyOS/Worker Agency Permission Granting in Progress
granteeDocumentId: <optional text>
allowedWorkerAgencyPermissions: <optional list>
note: <optional text>
inResponseTo: <optional correlation block>
```

`Granted`:

```yaml
type: MyOS/Worker Agency Permission Granted
granteeDocumentId: <optional text>
allowedWorkerAgencyPermissions: <optional list>
inResponseTo: <optional correlation block>
```

`Rejected` / `Invalid` / `Revoke Requested` / `Revoked` analogicznie do SDPG/LDPG.

### `MyOS/Start Worker Session Requested`
Status: **runtime-confirmed**

```yaml
type: MyOS/Start Worker Session Requested
requestId: <optional text>
onBehalfOf: <optional channelKey>
document: <blue node>
channelBindings:
  <channelKey>:
    accountId: <optional text>
    email: <optional text>
    timelineId: <optional text>
initialMessages:
  defaultMessage: <optional text>
  perChannel:
    <channelKey>: <text>
capabilities:
  <capabilityName>: <boolean>
name: <optional text>
description: <optional text>
```

**Ważna uwaga o konflikcie schema/runtime:**
- repo schema typuje `channelBindings` jako `record<string, ChannelSchema>`,
- ale `current MyOS runtime` runtime **aktywnie normalizuje** raw binding objects `{ accountId?, email?, timelineId? }` dla `Start Worker Session Requested`.

Wniosek dla DSL:
- helper `steps.myOs().startWorkerSessionRequested(...)` powinien wspierać binding objects w stylu bootstrap endpointu,
- ten runtime-backed wyjątek należy traktować jako świadomy compatibility rule.

## 5.9. `MyOS/Document Session Bootstrap`
Status: **runtime-confirmed**

To jest **wewnętrzny dokument trackingowy** używany przez MyOS bootstrap process.
Nie jest tym samym co `Conversation/Document Bootstrap Requested`.

Repo/local-definition shape:

```yaml
type: MyOS/Document Session Bootstrap
document: <blue node>
channelBindings:
  <channelKey>:
    accountId: <optional text>
    email: <optional text>
    timelineId: <optional text>
initialMessages:
  defaultMessage: <optional text>
  perChannel:
    <channelKey>: <text>
capabilities:
  <capabilityName>: <boolean>
bootstrapStatus: <optional Conversation/Document Status>
bootstrapError: <optional text>
initiatorSessionIds:
  - <sessionId>
participantsState:
  <channelKey>:
    type: MyOS/Participant Activation State
contracts:
  initiatedChannel / myOsAdminChannel   # runtime-created by bootstrap endpoint flow
  triggeredEventsChannel:
    type: Core/Triggered Event Channel
  lifecycle:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  initHandler:
    type: Conversation/Sequential Workflow
  handleParticipantResolved:
    type: Conversation/Sequential Workflow
  handleTargetDocumentSessionStarted:
    type: Conversation/Sequential Workflow
  handleBootstrapFailed:
    type: Conversation/Sequential Workflow
  handleStatusChange:
    type: Conversation/Sequential Workflow
```

Runtime notes:
- bootstrap endpoint materializuje dokument bootstrap trackingowy,
- MyOS Admin tworzy dwa sessions: initiator + admin,
- bootstrap document śledzi activation state uczestników, status, target session start i bootstrap failure.

Wniosek dla DSL:
- standardowy authoring DSL nie musi budować `MyOS/Document Session Bootstrap` jako pierwszorzędnego helpera użytkownika końcowego,
- ale helper bootstrap-related / tests / fixtures mogą go potrzebować jako runtime-native target shape.

## 5.10. Anchors / Links / permissions – canonical doc patterns

### `MyOS/Single Document Permission Grant To Account`
Status: **runtime-confirmed**

```yaml
name: <name>
type: MyOS/Single Document Permission Grant To Account
targetSessionId: <optional text>
granterDocumentSessionId: <optional text>
permissions:
  type: MyOS/Single Document Permission Set
contracts:
  granterChannel:
    type: MyOS/MyOS Timeline Channel
  granteeChannel:
    type: MyOS/MyOS Timeline Channel
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
  revoke:
    type: Conversation/Operation
  revokeImplGranter:
    type: Conversation/Sequential Workflow Operation
  validateOnInit:
    type: Conversation/Sequential Workflow
```

### `MyOS/Single Document Permission Grant To Document`
Status: **runtime-confirmed**

```yaml
name: <name>
type: MyOS/Single Document Permission Grant To Document
targetSessionId: <optional text>
granterDocumentSessionId: <optional text>
granteeDocumentId: <optional text>
skipValidation: <optional boolean>
permissions:
  type: MyOS/Single Document Permission Set
contracts:
  granterChannel:
    type: MyOS/MyOS Timeline Channel
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
  revoke:
    type: Conversation/Operation
  revokeImplGranter:
    type: Conversation/Sequential Workflow Operation
  validateOnInit:
    type: Conversation/Sequential Workflow
```

### `MyOS/Linked Documents Permission Grant To Account`
Status: **repo-confirmed + runtime-aligned**

```yaml
name: <name>
type: MyOS/Linked Documents Permission Grant To Account
targetSessionId: <optional text>
granterDocumentSessionId: <optional text>
links:
  type: MyOS/Linked Documents Permission Set
contracts:
  granterChannel:
    type: MyOS/MyOS Timeline Channel
  granteeChannel:
    type: MyOS/MyOS Timeline Channel
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
  revoke:
    type: Conversation/Operation
  revokeImplGranter:
    type: Conversation/Sequential Workflow Operation
  validateOnInit:
    type: Conversation/Sequential Workflow
```

### `MyOS/Linked Documents Permission Grant To Document`
Status: **repo-confirmed + runtime-aligned**

```yaml
name: <name>
type: MyOS/Linked Documents Permission Grant To Document
targetSessionId: <optional text>
granterDocumentSessionId: <optional text>
granteeDocumentId: <optional text>
skipValidation: <optional boolean>
links:
  type: MyOS/Linked Documents Permission Set
contracts:
  granterChannel:
    type: MyOS/MyOS Timeline Channel
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
  revoke:
    type: Conversation/Operation
  revokeImplGranter:
    type: Conversation/Sequential Workflow Operation
  validateOnInit:
    type: Conversation/Sequential Workflow
```

---

## 6. AI / LLM-provider pattern – finalne mappingi

## 6.1. Kluczowa decyzja

AI DSL nie powinien wymyślać osobnych magicznych typów request/response, jeśli docelowy runtime już działa na:
- `Conversation/Request`,
- `Conversation/Response`,
- `MyOS/Single Document Permission Grant Requested`,
- `MyOS/Subscribe to Session Requested`,
- `MyOS/Call Operation Requested`,
- `MyOS/Subscription Update`.

### Finalna decyzja

AI / LLM-provider DSL powinien być zbudowany jako warstwa convenience nad:
- standardowym session interaction,
- standardowymi Conversation request/response payloads,
- ewentualnie typami `MyOS/Agent`, `MyOS/LLM Agent`, `MyOS/Chat GPT Connector Agent` jako document type helpers.

## 6.2. Provider-side pattern

Status: **runtime-confirmed**

Minimalny provider pattern:

```yaml
contracts:
  ownerChannel:
    type: MyOS/MyOS Timeline Channel
  llmProviderChannel:
    type: MyOS/MyOS Timeline Channel

  provideInstructions:
    type: Conversation/Operation
    channel: ownerChannel
    request:
      instructions:
        type: Text
      requestId:
        type: Text
      requester:
        type: Text

  provideInstructionsImpl:
    type: Conversation/Sequential Workflow Operation
    operation: provideInstructions
    steps:
      - name: EmitRequest
        type: Conversation/JavaScript Code
        code: |
          const request = event.message?.request ?? {};
          if (!request.instructions) {
            return { events: [] };
          }
          return {
            events: [
              {
                type: 'Conversation/Request',
                ...request,
              },
            ],
          };

  provideResults:
    type: Conversation/Operation
    channel: llmProviderChannel

  provideResultsImpl:
    type: Conversation/Sequential Workflow Operation
    operation: provideResults
    steps:
      - name: EmitResponse
        type: Conversation/JavaScript Code
        code: |
          const request = event.message?.request ?? {};
          return {
            events: [
              {
                type: 'Conversation/Response',
                ...request,
              },
            ],
          };
```

## 6.3. Caller-side orchestration pattern

Status: **runtime-confirmed**

Canonical pattern:
1. request SDPG do provider session,
2. po `Single Document Permission Granted` otwórz subskrypcję,
3. filtruj `Conversation/Response` na provider subscription,
4. po gotowości subskrypcji emituj `MyOS/Call Operation Requested` dla `provideInstructions`,
5. obsłuż `MyOS/Subscription Update` z `update.type = Conversation/Response`.

To jest finalny runtime-backed mapping dla AI helperów typu:
- `ai(...).permissionFrom(...).done()`
- `steps.askAI(...)`
- `onAIResponse(...)`

Wniosek:
- AI DSL ma być warstwą nad istniejącym MyOS/session interaction + Conversation Request/Response,
- a nie osobnym światem typów.

---

## 7. PayNote – finalne mappingi

Ta sekcja **zastępuje** wcześniejszy paynote-only dokument i aktualizuje go na podstawie:
- aktualnych repo types z `public repository schemas`,
- feedbacku z current business-application flows,
- runtime semantics używanych w current business-application flows.

## 7.1. `PayNote/PayNote`
Status: **runtime-confirmed**

Repo-confirmed minimalny shape:

```yaml
name: <name>
type: PayNote/PayNote
currency: <optional Common/Currency>
amount:
  total: <optional number>
  reserved: <optional number>
  captured: <optional number>
status: <optional text>
transactionStatus: <optional PayNote/Transaction Status>
payNoteInitialStateDescription:
  summary: <optional text>
  details: <optional text>
contracts:
  payerChannel:
    type: Conversation/Timeline Channel   # repo shape
  payeeChannel:
    type: Conversation/Timeline Channel
  guarantorChannel:
    type: Conversation/Timeline Channel
  guarantorUpdate:
    type: Conversation/Operation
  guarantorUpdateImpl:
    type: Conversation/Sequential Workflow Operation
```

Final decision dla DSL:
- `PayNotes.payNote(name)` powinno tworzyć dokument typu `PayNote/PayNote`,
- helper nie powinien domyślnie duplikować dziedziczonych kontraktów,
- `payNoteInitialStateDescription` **istnieje w repo schema**, ale ze względu na feedback z aplikacji powinno pozostać **polem ad-hoc / advanced**, a nie natywną pierwszorzędną opcją helpera.

## 7.2. `PayNote/Card Transaction PayNote`
Status: **app-confirmed + repo-confirmed**

```yaml
name: <name>
type: PayNote/Card Transaction PayNote
currency: <optional Common/Currency>
amount:
  total: <optional number>
cardTransactionDetails:
  retrievalReferenceNumber: <optional text>
  systemTraceAuditNumber: <optional text>
  transmissionDateTime: <optional text>
  authorizationCode: <optional text>
transactionStatus: <optional PayNote/Transaction Status>
```

Final decision:
- `PayNotes.cardTransactionPayNote(name)` jest poprawnym helperem domenowym,
- `paymentMandateDocumentId` **nie należy do schemy tego dokumentu** i jeśli ma być dodawane, to jako pole ad-hoc przez generic DSL.

## 7.3. `PayNote/Merchant To Customer PayNote`
Status: **repo-confirmed**

W aktualnym `public repository schemas` typ **istnieje**.
To rozstrzyga wcześniejszy feedback z okresu, gdy typ mógł jeszcze nie być obecny.

Shape:

```yaml
name: <name>
type: PayNote/Merchant To Customer PayNote
currency: <optional Common/Currency>
amount:
  total: <optional number>
status: <optional text>
contracts: <odziedziczone jak w PayNote>
```

Final decision:
- helper `PayNotes.merchantToCustomerPayNote(name)` może istnieć jako typed alias,
- ale backendowe użycie tego typu trzeba nadal traktować jako mniej krytyczne niż bazowy `PayNote/PayNote` i `Card Transaction PayNote`.

## 7.4. `PayNote/PayNote Delivery`
Status: **app-confirmed + repo-confirmed**

Shape:

```yaml
name: <name>
type: PayNote/PayNote Delivery
cardTransactionDetails: <optional CardTransactionDetails>
payNoteBootstrapRequest: <optional Conversation/Document Bootstrap Requested>
paymentMandateBootstrapRequest: <optional Conversation/Document Bootstrap Requested>
deliveryStatus: <optional Conversation/Document Status>
transactionIdentificationStatus: <optional text>
clientDecisionStatus: <optional text>
clientAcceptedAt: <optional Common/Timestamp>
clientRejectedAt: <optional Common/Timestamp>
deliveryError: <optional text>
contracts:
  payNoteSender:
    type: MyOS/MyOS Timeline Channel
  payNoteDeliverer:
    type: MyOS/MyOS Timeline Channel
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
  initialize:
    type: Conversation/Sequential Workflow
  acceptPayNote:
    type: Conversation/Operation
  acceptPayNoteImpl:
    type: Conversation/Sequential Workflow Operation
  rejectPayNote:
    type: Conversation/Operation
  rejectPayNoteImpl:
    type: Conversation/Sequential Workflow Operation
  reportDeliveryError:
    type: Conversation/Operation
  reportDeliveryErrorImpl:
    type: Conversation/Sequential Workflow Operation
  updateTransactionIdentificationStatus:
    type: Conversation/Operation
  updateTransactionIdentificationStatusImpl:
    type: Conversation/Sequential Workflow Operation
```

Final decisions:
- operations channel key dla delivery flow to **`payNoteDeliverer`**,
- `payNoteSender` jest user-facing counterpart,
- helper domenowy nie powinien ręcznie dublować delivery operations, jeżeli typ już je zapewnia,
- `payNoteBootstrapRequest` i `paymentMandateBootstrapRequest` są poprawnymi polami typu,
- `payNoteInitialStateDescription` nie powinno być promowane w DSL helper API mimo że może pojawiać się w aplikacyjnych payloadach.

## 7.5. `PayNote/Payment Mandate`
Status: **repo-confirmed + refreshed**

Aktualny shape wg repo:

```yaml
name: <name>
type: PayNote/Payment Mandate
granterType: <optional text>
granterId: <optional text>
granteeType: <optional text>
granteeId: <optional text>
amountLimit: <optional number>
currency: <optional Common/Currency>
sourceAccount: <optional text>
amountReserved: <optional number>
amountCaptured: <optional number>
allowLinkedPayNote: <optional boolean>
allowedPayNotes:
  - documentBlueId: <optional text>
    typeBlueId: <optional text>
allowedPaymentCounterparties:
  - counterpartyType: <optional text>
    counterpartyId: <optional text>
expiresAt: <optional Common/Timestamp>
revokedAt: <optional Common/Timestamp>
chargeAttempts:
  <authorizationId>:
    amountMinor: <optional number>
    authorizationReason: <optional text>
    authorizationRespondedAt: <optional Common/Timestamp>
    authorizationStatus: <optional text>
    authorizedAmountMinor: <optional number>
    capturedDeltaMinor: <optional number>
    chargeMode: <optional text>
    counterpartyId: <optional text>
    counterpartyType: <optional text>
    currency: <optional Common/Currency>
    holdId: <optional text>
    lastSettlementId: <optional text>
    lastSettlementProcessingStatus: <optional text>
    lastSettlementRequestStatus: <optional text>
    reservedDeltaMinor: <optional number>
    settled: <optional boolean>
    settlementReason: <optional text>
    settlementRespondedAt: <optional Common/Timestamp>
    transactionId: <optional text>
contracts:
  granterChannel:
    type: MyOS/MyOS Timeline Channel
  granteeChannel:
    type: MyOS/MyOS Timeline Channel
  guarantorChannel:
    type: MyOS/MyOS Timeline Channel
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
  initialize:
    type: Conversation/Sequential Workflow
  authorizeSpend:
    type: Conversation/Operation
  authorizeSpendImpl:
    type: Conversation/Sequential Workflow Operation
  settleSpend:
    type: Conversation/Operation
  settleSpendImpl:
    type: Conversation/Sequential Workflow Operation
```

Final decisions:
- wcześniejszy status „deferred / requires refresh” zostaje zniesiony – aktualny repo daje wystarczający shape dokumentu,
- helper `PayNotes.paymentMandate(name)` może być implementowany w oparciu o powyższy mapping,
- operacje `authorizeSpend` / `settleSpend` są traktowane jako natywne, ale helper nie powinien ich duplikować, jeśli typ dokumentu już je zapewnia.

## 7.6. Eventy PayNote – finalne native payloads

### Reserve / capture / release

`PayNote/Reserve Funds Requested`:

```yaml
type: PayNote/Reserve Funds Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
```

`PayNote/Capture Funds Requested`:

```yaml
type: PayNote/Capture Funds Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
```

`PayNote/Reserve Funds and Capture Immediately Requested`:

```yaml
type: PayNote/Reserve Funds and Capture Immediately Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
```

`PayNote/Reservation Release Requested`:

```yaml
type: PayNote/Reservation Release Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
```

Final decision:
- **nie** promować `holdId` ani `paymentMandateDocumentId` jako natywnych pól tych czterech helperów, bo aktualne repo schema ich tam nie ma,
- jeśli aplikacja potrzebuje dodatkowego pola, może je dodać generic `.ext(...)`, ale nie jako repo-native option.

### Card transaction capture lock / unlock

`PayNote/Card Transaction Capture Lock Requested`:

```yaml
type: PayNote/Card Transaction Capture Lock Requested
requestId: <optional text>
cardTransactionDetails: <optional CardTransactionDetails>
name: <optional text>
description: <optional text>
```

`PayNote/Card Transaction Capture Unlock Requested`:

```yaml
type: PayNote/Card Transaction Capture Unlock Requested
requestId: <optional text>
cardTransactionDetails: <optional CardTransactionDetails>
name: <optional text>
description: <optional text>
```

### Monitoring

`PayNote/Start Card Transaction Monitoring Requested`:

```yaml
type: PayNote/Start Card Transaction Monitoring Requested
requestId: <optional text>
requestedAt: <optional number>
targetMerchantId: <optional text>
events:
  - <text>
name: <optional text>
description: <optional text>
```

Final decision:
- helper monitoring może istnieć jako typed helper,
- runtime aplikacyjny nadal traktuje to jako consent-like flow, ale mapping payloadu bierze się z aktualnej repo schema.

### Linked / reverse card charge requests

`PayNote/Linked Card Charge Requested`:

```yaml
type: PayNote/Linked Card Charge Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
paymentMandateDocumentId: <optional text>
paynote: <optional blue node>
```

`PayNote/Linked Card Charge and Capture Immediately Requested`:

```yaml
type: PayNote/Linked Card Charge and Capture Immediately Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
paymentMandateDocumentId: <optional text>
paynote: <optional blue node>
```

`PayNote/Reverse Card Charge Requested`:

```yaml
type: PayNote/Reverse Card Charge Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
paymentMandateDocumentId: <optional text>
paynote: <optional blue node>
```

`PayNote/Reverse Card Charge and Capture Immediately Requested`:

```yaml
type: PayNote/Reverse Card Charge and Capture Immediately Requested
requestId: <optional text>
amount: <optional number>
name: <optional text>
description: <optional text>
paymentMandateDocumentId: <optional text>
paynote: <optional blue node>
```

Final decisions:
- wbrew starszemu feedbackowi, `paymentMandateDocumentId` **istnieje** w aktualnym repo schema tych typów i może być natywną opcją helpera,
- `paynote` pozostaje opcjonalnym osadzonym dokumentem / child payloadem,
- app/runtime może wymagać mandatu w praktyce dla części flow, ale schema payloadu pozostaje opcjonalna.

### Payment Mandate request/response events

`PayNote/Payment Mandate Spend Authorization Requested`:

```yaml
type: PayNote/Payment Mandate Spend Authorization Requested
requestId: <optional text>
authorizationId: <optional text>
amountMinor: <optional number>
currency: <optional Common/Currency>
counterpartyType: <optional text>
counterpartyId: <optional text>
requestingDocumentId: <optional text>
requestingSessionId: <optional text>
requestedAt: <optional Common/Timestamp>
name: <optional text>
description: <optional text>
```

`PayNote/Payment Mandate Spend Settled`:

```yaml
type: PayNote/Payment Mandate Spend Settled
inResponseTo: <optional correlation block>
authorizationId: <optional text>
settlementId: <optional text>
status: <optional text>
reason: <optional text>
reservedDeltaMinor: <optional number>
capturedDeltaMinor: <optional number>
holdId: <optional text>
transactionId: <optional text>
settledAt: <optional Common/Timestamp>
name: <optional text>
description: <optional text>
```

---

## 8. Finalne implikacje dla DSL helperów wg etapów

## 8.1. Stage 3

Na podstawie tego dokumentu stage 3 powinien implementować helpery / matchery dla:
- `myOsAdmin(...)`
- `onTriggeredWithId(...)`
- `onTriggeredWithMatcher(...)`
- `onSubscriptionUpdate(...)`
- `onMyOsResponse(...)`
- `steps.myOs().singleDocumentPermissionGrantRequested(...)`
- `steps.myOs().linkedDocumentsPermissionGrantRequested(...)`
- `steps.myOs().subscribeToSessionRequested(...)`
- `steps.myOs().callOperationRequested(...)`

Source of truth dla stage 3:
- sekcje 4 i 5 niniejszego dokumentu.

## 8.2. Stage 4

Stage 4 (`access`, `accessLinked`, `agency`) powinien mapować się do:
- `Single Document Permission Grant Requested` + grant docs + response events,
- `Linked Documents Permission Grant Requested` + grant docs + response events,
- `Worker Agency Permission Grant Requested` + grant doc + worker session start.

Source of truth:
- sekcje 5.2, 5.3, 5.8, 5.10.

## 8.3. Stage 5

Stage 5 (AI) powinien mapować się do:
- `Conversation/Request`
- `Conversation/Response`
- session interaction flow przez MyOS Admin
- ewentualnie typy `MyOS/Agent`, `MyOS/LLM Agent`, `MyOS/Chat GPT Connector Agent`

Source of truth:
- sekcja 6.

## 8.4. Stage 6

Stage 6 (PayNote / payments) powinien mapować się do:
- sekcji 7.1–7.6,
- z wyraźnym rozróżnieniem pomiędzy:
  - repo-native fields,
  - runtime-required business conventions,
  - app-specific fields, które nie powinny być promoted do natywnego helpera bez dodatkowej potrzeby.

Final runtime notes:
- domyślne event-driven makra PayNote nadal materializują workflowy na
  `triggeredEventChannel`,
- overloady z `channelKey` mogą wiązać takie workflowy bezpośrednio z konkretnym
  kanałem timeline i wtedy matcher jest materializowany pod `event.message`,
- operation-triggered gałęzie PayNote nadal wymagają jawnego `request` schema na
  aktualnym publicznym runtime,
- `requestBackwardPayment(...)` pozostaje runtime-guarded, dopóki alias
  `PayNote/Backward Payment Requested` nie jest dostępny w publicznych typach repo.

---

## 9. Jawne decyzje „nie zgadujemy” / deferred

Na koniec lista rzeczy, których ten dokument świadomie **nie zgaduje**:

1. **Nie utożsamia** `Conversation/Document Bootstrap Requested` z bootstrap endpoint payloadem.
2. **Nie tworzy** fallbacku `Conversation/Event` tam, gdzie repo potwierdza `Common/Named Event`.
3. **Nie promuje** `payNoteInitialStateDescription` do natywnego helper API, mimo że pole istnieje w repo schema.
4. **Nie dopisuje** `holdId` / `paymentMandateDocumentId` do reserve/capture/release helperów, jeśli repo schema ich nie ma.
5. **Nie wprowadza** dodatkowych AI-specific payload types ponad obecny Request/Response/session-interaction pattern.
6. **Nie zakłada**, że każdy repo-confirmed typ ma już potwierdzony dedykowany backend flow w `current MyOS runtime`.

---

## 10. Finalna konkluzja

Tak zdefiniowany zestaw mappingów jest wystarczającą bazą do implementacji pozostałych warstw DSL SDK:
- MyOS foundations,
- access / linked access / agency,
- AI / LLM-provider pattern,
- PayNote / Payment Mandate / Delivery,

przy założeniu, że:
- core DSL z etapów 1–2 pozostaje bazą,
- implementacja nadal będzie weryfikowana runtime-backed testami,
- editing pipeline pozostanie osobnym workstreamem.

Najkrócej:

**tak – mając ten dokument oraz wcześniejsze materiały stage 1/2 można implementować pozostałe etapy authoring DSL SDK bez opierania się na niepewnych założeniach z Java POC.**
