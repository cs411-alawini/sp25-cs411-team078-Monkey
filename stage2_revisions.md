### Issue – UML Diagram:
- **-1** Many-to-1 foreign keys should not be explicitly labeled in the UML diagram, as they are implied by the relationships.

**How we addressed this issue:**  
Removed foreign key labels from the UML diagram to avoid redundancy and maintain clarity.

---

### Issue – Relational Schema:
- **-1** `Users → StudySession` is simultaneously described as a many-to-many and a many-to-exactly-one relationship. You included both a many-to-many join table (`UserSessions`) and a `SessionId` foreign key in `Users`, implying many-to-one. Only one relationship type should be used unless both are clearly explained (e.g., one for active session and one for session history).

**How we addressed this issue:**  
We resolved the issue by removing the `UserSessions` join table and keeping only the `SessionId` foreign key in the `Users` table. This change clearly defines a many-to-one relationship, where each user can be part of only one active study session at a time. This design aligns with our platform’s functionality, which encourages students to join a single session focused on a specific course. By eliminating the many-to-many mapping, we simplified the schema, ensured consistency between the UML explanation and relational design, and avoided redundancy in tracking user participation.

---

### Another Change:
While completing Stage 3, we made the following additional updates:

- **Added `CourseName` to the `Courses` table**: When downloading data from UIUC, the `CourseTitle` corresponds to the course number (e.g., CS374), and the `CourseName` represents the full title (e.g., *Introduction to Algorithms & Models of Computation*).

- **Added `SessionId` to the `Users` table**: We included the `SessionId` attribute to track the number of students in each study session. This was utilized in our advanced SQL query for Stage 3.

We also accounted for these changes in the **relational schema**, **UML diagram**, and the rest of the **Stage 2 documents**.
