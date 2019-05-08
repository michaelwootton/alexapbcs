"use strict";

const supertest = require("supertest");
describe('App Service', () => {
  let server;

  // test as full server
  describe('as standalone server', () => {
    // setup server
    beforeAll(() => server = require('../../index'));
    afterAll(done => server.close(() => done()));

    it('should respond to standalone endpoint', done => {
      supertest(server)
        .get('/components')
        .expect(200)
        .end(err => err ? done.fail(err) : done());
    });
  });
  
});
