
## 12. Interview Questions

Microservices are a major topic in senior engineering and system design interviews. Here is how to prepare.

### 12.1 Beginner
**Q: What is the main advantage of microservices over a monolithic architecture?**
**A:** Independent deployability and the ability to scale development teams organizationally. It solves the human coordination problem by defining strict technical boundaries. It also allows independent scaling of resources.

**Q: Why shouldn't microservices share a single relational database?**
**A:** Sharing a database creates tight coupling at the data layer. If Service A changes the schema of a table that Service B also reads from, Service B will break. This defeats the purpose of independent deployability. It's called the Shared Database Anti-Pattern.

### 12.2 Intermediate
**Q: Explain the API Gateway pattern. Why not let clients call microservices directly?**
**A:** If clients call services directly, they need to manage dozens of URLs, handle authentication multiple times, and make many round-trip calls over the internet (N+1 problem). An API Gateway acts as a single entry point, handles cross-cutting concerns like Auth and Rate Limiting, and can compose responses from multiple backend services, reducing client-side latency.

**Q: How do you handle distributed transactions? (e.g., booking a flight and a hotel)**
**A:** 2PC (Two-Phase Commit) is too slow and locks resources. Instead, use the Saga Pattern. It's a sequence of local transactions where each step publishes an event to trigger the next. If a step fails, the Saga executes *compensating transactions* to undo the previous steps (e.g., calling a `/cancel-flight` endpoint).

### 12.3 Advanced (FAANG-Level)
**Q: You have a highly concurrent system. Service A writes to its DB and publishes an event to Kafka. How do you guarantee the event is published if and only if the DB commits?**
**A:** Use the Transactional Outbox Pattern. Create an `outbox` table in Service A's database. When saving the entity, save the event payload to the outbox table in the *same ACID transaction*. Then, use a background polling thread or a CDC (Change Data Capture) tool like Debezium to read the outbox table and publish to Kafka.

**Q: In an event-driven architecture using Sagas, how do you handle messages arriving out of order or being processed twice?**
**A:** Network delivery guarantees are usually "at-least-once." Therefore, message consumers *must* be idempotent. This is achieved by tracking processed `Message IDs` in the database, or by designing operations to be naturally idempotent (e.g., `UPDATE status = 'PAID'` is idempotent; `UPDATE balance = balance - 10` is not). To handle out-of-order messages, you can use state machines or version numbers to reject older events if a newer one has already been processed.

## 13. Exercises

### 13.1 Conceptual Exercise: Domain Decomposition
You are building a "Food Delivery App" (like UberEats).
1. Identify at least 5 bounded contexts.
2. For each context, define the "Aggregate Root" entity.
3. Draw a diagram showing how these contexts communicate when a user places an order. (Which calls are synchronous? Which are asynchronous?)

### 13.2 Coding Exercise: The Strangler Fig
1. Create a simple Spring Boot Monolith with two REST endpoints: `/api/users` and `/api/orders`. 
2. Create a new, separate Spring Boot application for the `Order Service`.
3. Set up Spring Cloud Gateway (or NGINX) locally. Configure it to route `/api/users` to the Monolith on port 8080, and `/api/orders` to the new Order Service on port 8081.

### 13.3 System Design Exercise: Saga Implementation
Design a Saga for an E-commerce checkout process involving Inventory, Payment, and Shipping services.
1. Document the "Happy Path" sequence of events.
2. Document the "Failure Path" if the Payment fails but Inventory was already reserved. What are the specific compensating commands?
3. Decide whether you would use Choreography or Orchestration for this flow, and justify your choice.

## 14. Expert Insights

Microservices are a journey, not a destination. Here are insights from running these systems at scale:

1. **"Distributed Monoliths are Worse Than Monoliths."** The most common failure mode of microservice adoption is getting the boundaries wrong. If your services constantly require synchronous API calls to other services to complete a basic business function, you have built a distributed monolith. You suffer all the latency and operational pain of microservices without gaining decoupling. Redraw your boundaries based on DDD.
2. **"Eventual Consistency is a Business Decision, Not a Technical One."** Engineers stress over data being out of sync for 2 seconds. In reality, you must ask the Product Manager: "Is it okay if the user's updated profile picture doesn't appear on their old comments for 5 seconds?" Usually, the answer is yes. Don't build massive distributed locking systems to guarantee strong consistency if the business doesn't require it.
3. **"Master Observability Before Splitting."** Do not split a monolith until you have distributed tracing (OpenTelemetry) and centralized logging (ELK/Datadog) fully functional. Debugging microservices blindly is career-ending.
4. **"Embrace Dumb Pipes, Smart Endpoints."** A core tenet of microservices (unlike older SOA and ESB architectures). The communication mechanism (Kafka, RabbitMQ) should be "dumb"—it just routes messages. All the business logic, routing intelligence, and data transformation must live in the endpoints (the microservices themselves).

## 15. Chapter Summary

- **Microservices** solve the organizational bottlenecks of massive monoliths by decomposing software into independently deployable units based on business capabilities.
- **Domain-Driven Design (DDD)** and Bounded Contexts are the correct methodology for defining service boundaries to avoid distributed monoliths.
- **Database per Service** is a strict requirement to ensure decoupling. Data cannot be shared via database tables; it must be shared via APIs or Events.
- **API Gateways** manage external traffic, handling routing, composition, and cross-cutting concerns like authentication.
- **Sagas** replace 2PC for distributed transactions, using a sequence of local transactions and compensating actions to maintain data consistency.
- **Asynchronous Communication** (Event-Driven Architecture) is highly preferred over Synchronous (REST/gRPC) for inter-service communication to increase resilience and reduce temporal coupling.
- **Migration** should be iterative using the Strangler Fig pattern, never a "Big Bang" rewrite.
- **Observability** (Distributed Tracing, Centralized Logging, Metrics) is absolutely critical to survive the operational complexity of distributed systems.
